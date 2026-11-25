import { nextTrack, useMusicAvailable, useNowPlaying } from './music'
import { setPrefs, usePrefs, type BotSpeed } from './settings'
import { play, unlockAudio } from './sound'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs()
  const music = useMusicAvailable()
  const now = useNowPlaying()
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 id="settings-title">Settings</h2>

        <section className="set-row">
          <div>
            <b>Sound effects</b>
            <div className="small muted">Dice, paydays, deals and market news.</div>
          </div>
          <Toggle on={prefs.sound && !prefs.muted} onChange={(v) => { setPrefs({ sound: v, muted: false }); unlockAudio(); if (v) setTimeout(() => play('payday'), 30) }} label="Sound effects" />
        </section>
        <label className="set-slider">
          <span className="small muted">Effects volume</span>
          <input type="range" min={0} max={1} step={0.05} value={prefs.volume} disabled={!prefs.sound}
            onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
            onPointerUp={() => play('buy')} />
        </label>

        <section className="set-row">
          <div>
            <b>Music</b>
            <div className="small muted">
              {music === false ? 'Soundtrack unavailable right now.' : now ? `Now playing: ${now}` : 'Three original tracks, shuffled.'}
            </div>
          </div>
          <Toggle on={prefs.music && !prefs.muted && music !== false} disabled={music === false} onChange={(v) => setPrefs({ music: v, muted: false })} label="Music" />
        </section>
        {music !== false && (
          <div className="set-music">
            <label className="set-slider">
              <span className="small muted">Music volume</span>
              <input type="range" min={0} max={1} step={0.05} value={prefs.musicVolume} disabled={!prefs.music}
                onChange={(e) => setPrefs({ musicVolume: Number(e.target.value) })} />
            </label>
            <button className="btn btn-sm" disabled={!now} onClick={nextTrack} title="Skip to the next song">⏭ Next song</button>
          </div>
        )}

        <section className="set-row col">
          <div>
            <b>Computer player speed</b>
            <div className="small muted">How long bots pause so you can follow their moves.</div>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Computer player speed">
            {(['slow', 'normal', 'fast'] as BotSpeed[]).map((sp) => (
              <button key={sp} role="radio" aria-checked={prefs.botSpeed === sp} className={prefs.botSpeed === sp ? 'on' : ''}
                onClick={() => setPrefs({ botSpeed: sp })}>
                {sp === 'slow' ? '🐢 Slow' : sp === 'normal' ? '🚶 Normal' : '⚡ Fast'}
              </button>
            ))}
          </div>
        </section>

        <div className="actions">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span className="knob" />
    </button>
  )
}
