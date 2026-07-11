"use client";

import styles from "./UnitSystemSwitch.module.css";
import { useSwitchSound } from "./useSwitchSound";

export interface UnitSystemSwitchProps {
  value: "imperial" | "metric";
  onChange: (value: "imperial" | "metric") => void;
}

/**
 * A physical-looking toggle switch (Tommy: "make it look like an actual
 * switch and when you click it, it changes direction") standing in for the
 * old flat Imperial/Metric button pair — the knob visibly slides + tilts to
 * the other side on click, with a synthesized light-switch click sound
 * (see useSwitchSound.ts).
 */
export default function UnitSystemSwitch({ value, onChange }: UnitSystemSwitchProps) {
  const playClick = useSwitchSound();

  const handleToggle = () => {
    playClick();
    onChange(value === "imperial" ? "metric" : "imperial");
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value === "metric"}
      title="Toggle between Imperial and Metric units"
      className={styles.switchButton}
      data-state={value}
      onClick={handleToggle}
    >
      <span className={styles.label} data-active={value === "imperial"}>
        Imperial
      </span>
      <span className={styles.plate}>
        <span className={styles.track}>
          <span className={styles.knob} />
        </span>
      </span>
      <span className={styles.label} data-active={value === "metric"}>
        Metric
      </span>
    </button>
  );
}
