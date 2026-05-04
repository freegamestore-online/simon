import { useCallback, useEffect, useRef, useState } from "react";

interface GameProps {
  onScore: (s: number) => void;
  onGameOver: () => void;
}

type Color = "green" | "red" | "yellow" | "blue";

const COLORS: Color[] = ["green", "red", "yellow", "blue"];

const COLOR_MAP: Record<Color, { base: string; lit: string }> = {
  green:  { base: "#22c55e", lit: "#86efac" },
  red:    { base: "#ef4444", lit: "#fca5a5" },
  yellow: { base: "#eab308", lit: "#fde047" },
  blue:   { base: "#3b82f6", lit: "#93c5fd" },
};

const TONE_FREQ: Record<Color, number> = {
  green: 392,
  red: 330,
  yellow: 262,
  blue: 440,
};

function playTone(color: Color, duration: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = TONE_FREQ[color];
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available — skip sound
  }
}

function getFlashDuration(round: number): number {
  // Speed up every 5 rounds: start at 400ms, reduce by 50ms each tier, min 150ms
  const tier = Math.floor(round / 5);
  return Math.max(150, 400 - tier * 50);
}

function getPauseDuration(round: number): number {
  const tier = Math.floor(round / 5);
  return Math.max(100, 200 - tier * 25);
}

export function Game({ onScore, onGameOver }: GameProps) {
  const [sequence, setSequence] = useState<Color[]>([]);
  const [litColor, setLitColor] = useState<Color | null>(null);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [isShowingSequence, setIsShowingSequence] = useState(true);
  const [round, setRound] = useState(0);
  const [pressedColor, setPressedColor] = useState<Color | null>(null);

  const alive = useRef(true);
  const onScoreRef = useRef(onScore);
  const onGameOverRef = useRef(onGameOver);
  onScoreRef.current = onScore;
  onGameOverRef.current = onGameOver;

  const showSequence = useCallback((seq: Color[], currentRound: number) => {
    setIsShowingSequence(true);
    const flashMs = getFlashDuration(currentRound);
    const pauseMs = getPauseDuration(currentRound);

    // Initial delay before starting sequence
    let delay = 600;
    seq.forEach((color, i) => {
      setTimeout(() => {
        if (!alive.current) return;
        setLitColor(color);
        playTone(color, flashMs);
      }, delay);

      setTimeout(() => {
        if (!alive.current) return;
        setLitColor(null);
      }, delay + flashMs);

      delay += flashMs + pauseMs;

      // After last color, enable player input
      if (i === seq.length - 1) {
        setTimeout(() => {
          if (!alive.current) return;
          setIsShowingSequence(false);
          setPlayerIndex(0);
        }, delay);
      }
    });
  }, []);

  // Start first round on mount
  useEffect(() => {
    alive.current = true;
    const first = COLORS[Math.floor(Math.random() * 4)]!;
    const seq = [first];
    setSequence(seq);
    setRound(0);
    onScoreRef.current(0);
    showSequence(seq, 0);

    return () => {
      alive.current = false;
    };
  }, [showSequence]);

  const advanceRound = useCallback((prevSeq: Color[], prevRound: number) => {
    const next = COLORS[Math.floor(Math.random() * 4)]!;
    const newSeq = [...prevSeq, next];
    const newRound = prevRound + 1;
    setSequence(newSeq);
    setRound(newRound);
    onScoreRef.current(newRound);
    showSequence(newSeq, newRound);
  }, [showSequence]);

  const handlePress = useCallback((color: Color) => {
    if (isShowingSequence || !alive.current) return;

    const expected = sequence[playerIndex];
    setPressedColor(color);
    playTone(color, 200);

    setTimeout(() => setPressedColor(null), 150);

    if (color !== expected) {
      alive.current = false;
      onGameOverRef.current();
      return;
    }

    const nextIndex = playerIndex + 1;
    if (nextIndex >= sequence.length) {
      // Player completed the sequence -- advance round
      setIsShowingSequence(true);
      setPlayerIndex(0);
      setTimeout(() => {
        if (!alive.current) return;
        advanceRound(sequence, round);
      }, 500);
    } else {
      setPlayerIndex(nextIndex);
    }
  }, [isShowingSequence, sequence, playerIndex, advanceRound, round]);

  // Keyboard support: arrow keys or WASD
  useEffect(() => {
    const keyMap: Record<string, Color> = {
      ArrowUp: "green",
      w: "green",
      ArrowRight: "red",
      d: "red",
      ArrowDown: "yellow",
      s: "yellow",
      ArrowLeft: "blue",
      a: "blue",
    };

    const handleKey = (e: KeyboardEvent) => {
      const color = keyMap[e.key];
      if (color) {
        e.preventDefault();
        handlePress(color);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePress]);

  const getButtonStyle = (color: Color): React.CSSProperties => {
    const isLit = litColor === color;
    const isPressed = pressedColor === color;
    const active = isLit || isPressed;
    const map = COLOR_MAP[color];

    return {
      background: active ? map.lit : map.base,
      transform: isPressed ? "scale(0.95)" : "scale(1)",
      transition: "background 0.15s, transform 0.1s",
      opacity: isShowingSequence && !isLit ? 0.6 : 1,
    };
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
      <div className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
        {isShowingSequence ? "Watch..." : "Your turn!"}
      </div>

      {/* Cross / diamond layout */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "1fr 1fr 1fr",
          width: "min(80vw, 380px)",
          height: "min(80vw, 380px)",
        }}
      >
        {/* Row 1: top (green) in center */}
        <div />
        <button
          onPointerDown={() => handlePress("green")}
          className="rounded-2xl cursor-pointer border-0 min-h-[120px]"
          style={getButtonStyle("green")}
          aria-label="Green"
        />
        <div />

        {/* Row 2: left (blue), empty center, right (red) */}
        <button
          onPointerDown={() => handlePress("blue")}
          className="rounded-2xl cursor-pointer border-0 min-h-[120px]"
          style={getButtonStyle("blue")}
          aria-label="Blue"
        />
        <div />
        <button
          onPointerDown={() => handlePress("red")}
          className="rounded-2xl cursor-pointer border-0 min-h-[120px]"
          style={getButtonStyle("red")}
          aria-label="Red"
        />

        {/* Row 3: bottom (yellow) in center */}
        <div />
        <button
          onPointerDown={() => handlePress("yellow")}
          className="rounded-2xl cursor-pointer border-0 min-h-[120px]"
          style={getButtonStyle("yellow")}
          aria-label="Yellow"
        />
        <div />
      </div>

      <div className="text-xs" style={{ color: "var(--muted)" }}>
        Tap or use arrow keys / WASD
      </div>
    </div>
  );
}
