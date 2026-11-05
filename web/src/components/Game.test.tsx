import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { Game } from "./Game";

beforeEach(() => {
  vi.useFakeTimers();
  // COLORS[0] is green, so the first sequence is always [green].
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderAndWaitForTurn() {
  const onGameOver = vi.fn();
  render(<Game onScore={() => {}} onGameOver={onGameOver} />);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByText("Your turn!")).toBeInTheDocument();
  return onGameOver;
}

describe("Simon wrong press", () => {
  it("highlights the correct button before ending the game", () => {
    const onGameOver = renderAndWaitForTurn();
    fireEvent.pointerDown(screen.getByLabelText("Red"));

    expect(screen.getByText("Wrong!")).toBeInTheDocument();
    expect(screen.getByLabelText("Green").style.boxShadow).not.toBe("");
    expect(screen.getByLabelText("Red").style.boxShadow).toBe("");
    expect(onGameOver).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(onGameOver).toHaveBeenCalledOnce();
  });

  it("ignores further presses after a mistake", () => {
    const onGameOver = renderAndWaitForTurn();
    fireEvent.pointerDown(screen.getByLabelText("Red"));
    fireEvent.pointerDown(screen.getByLabelText("Blue"));
    act(() => vi.advanceTimersByTime(1000));
    expect(onGameOver).toHaveBeenCalledOnce();
  });

  it("does not fire timers after unmount", () => {
    const onGameOver = vi.fn();
    const { unmount } = render(<Game onScore={() => {}} onGameOver={onGameOver} />);
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.pointerDown(screen.getByLabelText("Red"));
    unmount();
    vi.advanceTimersByTime(2000);
    expect(onGameOver).not.toHaveBeenCalled();
  });
});

describe("Simon keyboard", () => {
  it("ignores auto-repeat and modifier shortcuts", () => {
    const onGameOver = renderAndWaitForTurn();
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    fireEvent.keyDown(window, { key: "ArrowDown", repeat: true });
    expect(screen.getByText("Your turn!")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("Wrong!")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(onGameOver).toHaveBeenCalledOnce();
  });
});
