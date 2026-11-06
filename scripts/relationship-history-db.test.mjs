// Run with PGLITE_MODULE pointing to a temporary install; no production DB or app dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('relationship migration: ownership, orphan preservation and continuation baseline', async () => {
  const modulePath = process.env.PGLITE_MODULE;
  if (!modulePath) throw new Error('Set PGLITE_MODULE to a temporary @electric-sql/pglite/dist/index.js installation.');
  const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      create table auth.users (id uuid primary key);
      create table public.series (id uuid primary key default gen_random_uuid(), user_id uuid, title text);
      create table public.books (id uuid primary key default gen_random_uuid(), user_id uuid, title text default '', series_id uuid, series_order int);
      create table public.characters (id uuid primary key default gen_random_uuid(), book_id uuid references books(id), user_id uuid,
        name text default '', aliases text[] default '{}', role text default 'protagonist', position int default 0,
        quote text default '', age int, appearance text default '', personality text default '', backstory text default '', notes text default '',
        gap text default '', interior_life text default '', exterior_life text default '', avatar_url text);
      create table public.chapters (id uuid primary key default gen_random_uuid(), book_id uuid references books(id), user_id uuid, title text default '', position int default 0, created_at timestamptz default now());
      create table public.locations (book_id uuid); create table public.notes (book_id uuid);
      create table public.timeline_events (book_id uuid); create table public.map_stamps (book_id uuid);
      create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
    `);
    const base = await readFile(new URL('../supabase/migrations/0020_character_relationships.sql', import.meta.url), 'utf8');
    await db.exec(base.slice(base.indexOf('create table'), base.indexOf('-- Мигрировать')));
    await db.exec(`
      grant select, insert, update, delete on public.books, public.characters, public.chapters to authenticated;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
      insert into books(id,user_id) values
        ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
        ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001'),
        ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');
      insert into characters(id,book_id,user_id,name) values
        ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Anna'),
        ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Boris'),
        ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Other');
      insert into chapters(id,book_id,user_id,title,position) values
        ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','First',1),
        ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Later',2),
        ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Foreign',3),
        ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Other book',4),
        ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Moved',99);
      insert into character_relationships(id,book_id,user_id,char_a_id,char_b_id,label_a,label_b) values
        ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Brother','Sister');
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261106090935_character_relationship_history.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('select is_secret from character_relationships')).rows[0].is_secret, false);
    const insert = `insert into character_relationship_events(book_id,user_id,relationship_id,chapter_id,label_a,label_b,is_secret,note)
      values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',$1,'Ally','Trusts',true,'Saved note') returning *`;
    await db.exec(`set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
    const event = (await db.query(insert, ['30000000-0000-0000-0000-000000000001'])).rows[0];
    assert.equal(event.chapter_title, 'First');
    await assert.rejects(db.query(insert, ['30000000-0000-0000-0000-000000000001']), /unique|duplicate/i);
    await assert.rejects(db.query(insert, ['30000000-0000-0000-0000-000000000003']), /chapter does not belong/i);
    await assert.rejects(db.query(insert, ['30000000-0000-0000-0000-000000000004']), /chapter does not belong/i);
    await assert.rejects(db.exec(`update character_relationship_events set user_id='00000000-0000-0000-0000-000000000002'`), /row.level security|chapter does not belong/i);
    await assert.rejects(db.exec(`update character_relationship_events set note=repeat('x',4001)`), /check constraint/i);
    await assert.rejects(db.exec(`insert into character_relationships(book_id,user_id,char_a_id,char_b_id) values
      ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003')`), /row.level security/i);
    await db.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'`);
    assert.equal((await db.query('select * from character_relationship_events')).rows.length, 0);
    assert.equal((await db.query('delete from character_relationship_events returning id')).rows.length, 0);
    assert.equal((await db.query(`update character_relationship_events set note='stolen' returning id`)).rows.length, 0);
    await assert.rejects(db.query(insert, ['30000000-0000-0000-0000-000000000002']), /row.level security/i);
    await db.exec(`set role anon`);
    await assert.rejects(db.query('select * from character_relationship_events'), /permission denied/i);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
    await db.exec(`delete from chapters where id='30000000-0000-0000-0000-000000000001'`);
    const orphan = (await db.query('select * from character_relationship_events')).rows[0];
    assert.equal(orphan.chapter_id, null); assert.equal(orphan.note, 'Saved note'); assert.equal(orphan.chapter_title, 'First');
    await db.query(insert, ['30000000-0000-0000-0000-000000000002']);
    await db.query(insert, ['30000000-0000-0000-0000-000000000005']);
    await db.exec(`update character_relationship_events set label_a='Wrong future', is_secret=false where chapter_id='30000000-0000-0000-0000-000000000005';
      update chapters set book_id='10000000-0000-0000-0000-000000000002' where id='30000000-0000-0000-0000-000000000005'`);
    await db.exec(`select duplicate_book_content('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',true,false,false,false)`);
    const copied = (await db.query(`select r.*, a.name as name_a from character_relationships r join characters a on a.id=r.char_a_id where r.book_id='10000000-0000-0000-0000-000000000002'`)).rows[0];
    assert.equal(copied.is_secret, true);
    assert.equal(copied.name_a === 'Anna' ? copied.label_a : copied.label_b, 'Ally');
    assert.equal(copied.name_a === 'Anna' ? copied.label_b : copied.label_a, 'Trusts');
    assert.equal((await db.query(`select * from character_relationship_events where book_id='10000000-0000-0000-0000-000000000002'`)).rows.length, 0);
    await db.exec(`delete from character_relationships where id='40000000-0000-0000-0000-000000000001'`);
    assert.equal((await db.query('select * from character_relationship_events')).rows.length, 0);
  } finally { await db.close(); }
});
