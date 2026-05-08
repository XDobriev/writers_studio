import { EditorHybrid } from '../components/EditorHybrid';

export default function Editor() {
  return (
    <div style={{ height: '100vh' }}>
      <EditorHybrid defaultMode="studio" />
    </div>
  );
}
