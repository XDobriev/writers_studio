import { renderHook, act } from '@testing-library/react';
import { useToolbarAutoHide } from './useToolbarAutoHide';

const DELAY = 2000;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useToolbarAutoHide', () => {
  it('starts visible', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));
    expect(result.current.visible).toBe(true);
  });

  it('hides after hideDelay following keydown', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.onKeyDown(); });
    expect(result.current.visible).toBe(true); // still visible before delay

    act(() => { vi.advanceTimersByTime(DELAY); });
    expect(result.current.visible).toBe(false);
  });

  it('does not hide before hideDelay elapses', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY - 1); });
    expect(result.current.visible).toBe(true);
  });

  it('mousemove before timer fires cancels hide', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY / 2); });
    act(() => { result.current.containerHandlers.onMouseMove(); });
    act(() => { vi.advanceTimersByTime(DELAY); }); // advance well past original delay
    expect(result.current.visible).toBe(true);
  });

  it('mousemove after hide restores visibility', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY); });
    expect(result.current.visible).toBe(false);

    act(() => { result.current.containerHandlers.onMouseMove(); });
    expect(result.current.visible).toBe(true);
  });

  it('multiple keydowns reset the timer (debounce)', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY - 500); }); // 1500ms in
    act(() => { result.current.onKeyDown(); });            // reset timer
    act(() => { vi.advanceTimersByTime(500); });           // only 500ms since last keydown
    expect(result.current.visible).toBe(true);            // < 2000ms from last keydown

    act(() => { vi.advanceTimersByTime(DELAY - 500); });  // now 2000ms from last keydown
    expect(result.current.visible).toBe(false);
  });

  it('mouseenter toolbar cancels hide while hovering', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.onKeyDown(); });
    act(() => { result.current.toolbarHandlers.onMouseEnter(); });
    act(() => { vi.advanceTimersByTime(DELAY * 2); }); // far past delay
    expect(result.current.visible).toBe(true);
  });

  it('keydown while hovering: timer fires but does not hide', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.toolbarHandlers.onMouseEnter(); });
    act(() => { result.current.onKeyDown(); }); // schedule while hovering
    act(() => { vi.advanceTimersByTime(DELAY); });
    expect(result.current.visible).toBe(true); // isHovering blocked the hide
  });

  it('mouseleave alone does not schedule hide', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.toolbarHandlers.onMouseEnter(); });
    act(() => { result.current.toolbarHandlers.onMouseLeave(); });
    act(() => { vi.advanceTimersByTime(DELAY * 2); });
    expect(result.current.visible).toBe(true);
  });

  it('after mouseleave, next keydown hides correctly', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.toolbarHandlers.onMouseEnter(); });
    act(() => { result.current.toolbarHandlers.onMouseLeave(); });
    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY); });
    expect(result.current.visible).toBe(false);
  });

  it('enabled=false: keydown never hides toolbar', () => {
    const { result } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY, enabled: false }));

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY * 2); });
    expect(result.current.visible).toBe(true);
  });

  it('switching enabled false→true re-enables auto-hide', () => {
    let enabled = false;
    const { result, rerender } = renderHook(
      ({ e }: { e: boolean }) => useToolbarAutoHide({ hideDelay: DELAY, enabled: e }),
      { initialProps: { e: false } },
    );

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY * 2); });
    expect(result.current.visible).toBe(true); // was disabled

    enabled = true;
    rerender({ e: enabled });

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY); });
    expect(result.current.visible).toBe(false); // now enabled, hides
  });

  it('switching enabled true→false restores visibility and cancels timer', () => {
    const { result, rerender } = renderHook(
      ({ e }: { e: boolean }) => useToolbarAutoHide({ hideDelay: DELAY, enabled: e }),
      { initialProps: { e: true } },
    );

    act(() => { result.current.onKeyDown(); });
    act(() => { vi.advanceTimersByTime(DELAY); });
    expect(result.current.visible).toBe(false); // hidden

    rerender({ e: false });
    expect(result.current.visible).toBe(true); // restored on disable

    act(() => { vi.advanceTimersByTime(DELAY * 2); }); // no lingering timer
    expect(result.current.visible).toBe(true);
  });

  it('cleans up timer on unmount without throwing', () => {
    const { result, unmount } = renderHook(() => useToolbarAutoHide({ hideDelay: DELAY }));

    act(() => { result.current.onKeyDown(); });
    expect(() => unmount()).not.toThrow();
    // advance past delay: no setState-after-unmount error
    expect(() => act(() => { vi.advanceTimersByTime(DELAY); })).not.toThrow();
  });
});
