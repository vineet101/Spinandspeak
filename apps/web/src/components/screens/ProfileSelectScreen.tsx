"use client";

import type { ChildProfile } from "@spin-and-speak/domain";
import { LEVEL_LABELS } from "@spin-and-speak/domain";

export function ProfileSelectScreen({
  profiles,
  onSelect,
  onAdd
}: {
  profiles: ChildProfile[];
  onSelect: (profile: ChildProfile) => void;
  onAdd: () => void;
}) {
  return (
    <main className="screen profile-screen">
      <header className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div>
          <div className="brand-name">Spin &amp; Speak</div>
          <div className="brand-kicker">One minute. Your voice.</div>
        </div>
      </header>

      <section className="hero-copy">
        <p className="eyebrow">Ready?</p>
        <h1>Pick your player</h1>
      </section>

      {profiles.length === 0 ? (
        <button className="empty-profile-card" onClick={onAdd}>
          <span className="plus-circle">+</span>
          <strong>Add your first player</strong>
          <span>Each player gets their own scores and progress.</span>
        </button>
      ) : (
        <div className="profile-grid">
          {profiles.map((profile, index) => (
            <button className="profile-card" key={profile.id} onClick={() => onSelect(profile)}>
              <span className={`avatar avatar-${index % 4}`}>{profile.name.slice(0, 1).toUpperCase()}</span>
              <span className="profile-card-main">
                <strong>{profile.name}</strong>
                <span>Level {profile.currentLevel} · {LEVEL_LABELS[profile.currentLevel]}</span>
              </span>
              <span className="chevron">›</span>
            </button>
          ))}
        </div>
      )}

      {profiles.length > 0 && (
        <button className="secondary-button wide" onClick={onAdd}>+ Add player</button>
      )}
    </main>
  );
}
