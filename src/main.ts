import './style.css'

type Direction = 'down' | 'up'
type CellType = 'empty' | 'treasure' | 'oxygen'

interface Cell {
  depth: number
  type: CellType
  value?: number
  collected?: boolean
}

const TOTAL_DEPTH = 20
const DESCENT_TAPS_PER_CELL = 10
const ASCENT_TAPS_PER_CELL = 15
const EXTRA_TAPS_PER_TREASURE = 5

const specialCells: Record<number, Omit<Cell, 'depth'>> = {
  3: { type: 'treasure', value: 100 },
  4: { type: 'oxygen' },
  6: { type: 'treasure', value: 200 },
  8: { type: 'oxygen' },
  10: { type: 'treasure', value: 350 },
  12: { type: 'treasure', value: 500 },
  13: { type: 'oxygen' },
  16: { type: 'treasure', value: 800 },
  18: { type: 'oxygen' },
  19: { type: 'treasure', value: 1200 },
  20: { type: 'treasure', value: 2000 },
}

const cells: Cell[] = Array.from({ length: TOTAL_DEPTH }, (_, index) => {
  const depth = index + 1
  const special = specialCells[depth]
  return special ? { depth, ...special } : { depth, type: 'empty' }
})

const state = {
  depth: 0,
  direction: 'down' as Direction,
  rolledSeconds: null as number | null,
  active: false,
  tapsThisBurst: 0,
  tapProgress: 0,
  timeLeftMs: 0,
  weight: 0,
  carriedLoot: [] as number[],
  bankedScore: 0,
  message: 'Roll the die to begin your dive.',
  returnedOnce: false,
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App root not found')

let timerId: number | null = null
let burstEndsAt = 0

function tapsRequired(): number {
  if (state.direction === 'down') return DESCENT_TAPS_PER_CELL
  return ASCENT_TAPS_PER_CELL + state.weight * EXTRA_TAPS_PER_TREASURE
}

function currentCell(): Cell | undefined {
  return cells.find((cell) => cell.depth === state.depth)
}

function rollDie(): void {
  if (state.active || state.rolledSeconds !== null) return

  state.rolledSeconds = Math.floor(Math.random() * 6) + 1
  state.tapProgress = 0
  state.message = `You rolled ${state.rolledSeconds}. Choose your direction, then swim!`

  if (state.depth === 0) state.direction = 'down'
  if (state.depth === TOTAL_DEPTH) state.direction = 'up'
  render()
}

function setDirection(direction: Direction): void {
  if (state.active || state.rolledSeconds === null) return
  if (state.depth === 0 && direction === 'up') return
  if (state.depth === TOTAL_DEPTH && direction === 'down') return

  state.direction = direction
  state.tapProgress = 0
  render()
}

function startBurst(): void {
  if (state.active || state.rolledSeconds === null) return

  const seconds = state.rolledSeconds
  state.active = true
  state.tapsThisBurst = 0
  state.tapProgress = 0
  state.timeLeftMs = seconds * 1000
  burstEndsAt = performance.now() + state.timeLeftMs
  state.message = state.depth === 0 ? 'DIVE! Tap as fast as you can!' : 'SWIM! Tap as fast as you can!'

  if (timerId !== null) window.clearInterval(timerId)
  timerId = window.setInterval(updateTimer, 50)
  render()
}

function updateTimer(): void {
  if (!state.active) return

  state.timeLeftMs = Math.max(0, burstEndsAt - performance.now())
  if (state.timeLeftMs <= 0) {
    finishBurst()
    return
  }
  render()
}

function finishBurst(): void {
  if (timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }

  state.active = false
  state.timeLeftMs = 0
  state.rolledSeconds = null

  if (state.depth === TOTAL_DEPTH) {
    state.direction = 'up'
    state.message = 'You reached the bottom. Next move: up.'
  } else {
    state.message = `Burst finished: ${state.tapsThisBurst} taps.`
  }

  render()
}

function handleTap(): void {
  if (!state.active) return

  state.tapsThisBurst += 1
  state.tapProgress += 1

  const required = tapsRequired()
  if (state.tapProgress >= required) {
    state.tapProgress -= required
    moveOneCell()
  }

  render()
}

function moveOneCell(): void {
  if (state.direction === 'down') {
    if (state.depth >= TOTAL_DEPTH) return
    state.depth += 1

    if (state.depth === TOTAL_DEPTH) {
      endBurstEarly('Bottom reached. Now you have to get back up.')
      return
    }
  } else {
    if (state.depth <= 0) return
    state.depth -= 1

    if (state.depth === 0) {
      returnToBoat()
      return
    }
  }

  const cell = currentCell()
  if (cell?.type === 'oxygen') {
    state.message = 'Oxygen tank spotted. Its oxygen mechanic is coming next.'
  }
}

function endBurstEarly(message: string): void {
  if (timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }
  state.active = false
  state.timeLeftMs = 0
  state.rolledSeconds = null
  state.tapProgress = 0
  state.message = message
}

function returnToBoat(): void {
  const recovered = state.carriedLoot.reduce((sum, value) => sum + value, 0)
  state.bankedScore += recovered
  state.carriedLoot = []
  state.weight = 0
  state.direction = 'down'
  state.returnedOnce = true
  endBurstEarly(recovered > 0 ? `SAFE! You recovered €${recovered}.` : 'SAFE! Back on the boat.')
}

function pickUpTreasure(): void {
  if (state.active) return
  const cell = currentCell()
  if (!cell || cell.type !== 'treasure' || cell.collected || cell.value === undefined) return

  cell.collected = true
  state.carriedLoot.push(cell.value)
  state.weight += 1
  state.message = `Treasure collected: €${cell.value}. Going up now costs more taps.`
  render()
}

function resetGame(): void {
  if (timerId !== null) window.clearInterval(timerId)
  timerId = null

  cells.forEach((cell) => {
    if (cell.type === 'treasure') cell.collected = false
  })

  state.depth = 0
  state.direction = 'down'
  state.rolledSeconds = null
  state.active = false
  state.tapsThisBurst = 0
  state.tapProgress = 0
  state.timeLeftMs = 0
  state.weight = 0
  state.carriedLoot = []
  state.bankedScore = 0
  state.message = 'Roll the die to begin your dive.'
  state.returnedOnce = false
  render()
}

function cellIcon(cell: Cell): string {
  if (cell.type === 'oxygen') return '🫧'
  if (cell.type === 'treasure') return cell.collected ? '·' : '💎'
  return '·'
}

function renderTrack(): string {
  const boatDiver = state.depth === 0 ? '<span class="boat-diver" aria-label="diver">🤿</span>' : ''

  const cellMarkup = cells
    .map((cell) => {
      const hasDiver = state.depth === cell.depth
      const activeClass = hasDiver ? ' depth-cell--active' : ''
      const specialClass = cell.type !== 'empty' ? ` depth-cell--${cell.type}` : ''
      const label = cell.type === 'treasure' && !cell.collected
        ? `Treasure worth €${cell.value}`
        : cell.type === 'oxygen'
          ? 'Oxygen tank'
          : `Depth ${cell.depth}`

      return `
        <div class="depth-row">
          <span class="depth-number">${String(cell.depth).padStart(2, '0')}</span>
          <div class="depth-cell${activeClass}${specialClass}" title="${label}">
            <span class="cell-item">${cellIcon(cell)}</span>
            ${hasDiver ? '<span class="diver" aria-label="current player">🤿</span>' : ''}
          </div>
        </div>
      `
    })
    .join('')

  return `
    <div class="ocean-panel">
      <div class="surface">
        <div class="boat" aria-label="boat">🚤${boatDiver}</div>
        <div class="wave-line">≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈</div>
      </div>
      <div class="depth-track">${cellMarkup}</div>
      <div class="seabed">𓇼 &nbsp; SEABED &nbsp; 𓆝</div>
    </div>
  `
}

function renderControls(): string {
  const seconds = state.rolledSeconds
  const current = currentCell()
  const canCollect = !state.active && current?.type === 'treasure' && !current.collected
  const directionLocked = state.active || seconds === null
  const displayedRequired = tapsRequired()
  const progressPercent = Math.min(100, (state.tapProgress / displayedRequired) * 100)
  const timeSeconds = (state.timeLeftMs / 1000).toFixed(1)
  const carrying = state.carriedLoot.reduce((sum, value) => sum + value, 0)

  return `
    <aside class="control-panel">
      <div class="stats">
        <div><span>Depth</span><strong>${state.depth}/${TOTAL_DEPTH}</strong></div>
        <div><span>Weight</span><strong>${state.weight}</strong></div>
        <div><span>Carrying</span><strong>€${carrying}</strong></div>
        <div><span>Banked</span><strong>€${state.bankedScore}</strong></div>
      </div>

      <div class="status-card" aria-live="polite">
        <span class="eyebrow">CURRENT STATUS</span>
        <p>${state.message}</p>
      </div>

      <div class="dice-section">
        <button class="dice-button" data-action="roll" ${state.active || seconds !== null ? 'disabled' : ''}>
          <span class="die-face">${seconds ?? '🎲'}</span>
          <span>${seconds === null ? 'ROLL DIE' : `${seconds} SECOND${seconds === 1 ? '' : 'S'}`}</span>
        </button>
      </div>

      <div class="direction-section">
        <span class="eyebrow">DIRECTION</span>
        <div class="direction-buttons">
          <button data-action="down" class="direction-button ${state.direction === 'down' ? 'selected' : ''}" ${directionLocked || state.depth === TOTAL_DEPTH ? 'disabled' : ''}>↓ DOWN</button>
          <button data-action="up" class="direction-button ${state.direction === 'up' ? 'selected' : ''}" ${directionLocked || state.depth === 0 ? 'disabled' : ''}>↑ UP</button>
        </div>
        <small>${state.direction === 'down' ? `${DESCENT_TAPS_PER_CELL} taps per cell` : `${displayedRequired} taps per cell (${ASCENT_TAPS_PER_CELL} base + weight)`}</small>
      </div>

      ${canCollect ? `<button class="collect-button" data-action="collect">💎 PICK UP €${current.value}</button>` : ''}

      ${!state.active && seconds !== null ? `<button class="start-button" data-action="start">START SWIMMING — ${seconds}s</button>` : ''}

      <button class="tap-zone ${state.active ? 'tap-zone--active' : ''}" data-action="tap" ${state.active ? '' : 'disabled'}>
        <span class="tap-title">${state.active ? 'TAP! TAP! TAP!' : 'TAPPING ZONE'}</span>
        <span class="timer">${state.active ? `${timeSeconds}s` : '—'}</span>
        <span class="tap-count">${state.tapsThisBurst} taps</span>
        <span class="progress-label">${state.tapProgress} / ${displayedRequired} to next cell</span>
        <span class="progress-track"><span style="width:${progressPercent}%"></span></span>
      </button>

      <div class="rules-strip">
        <span>↓ <strong>10</strong> taps/cell</span>
        <span>↑ <strong>15</strong> taps/cell</span>
        <span>💎 <strong>+5</strong> up taps</span>
      </div>

      <button class="reset-button" data-action="reset">Reset prototype</button>
    </aside>
  `
}

function render(): void {
  app.innerHTML = `
    <main class="game-shell">
      <header class="game-header">
        <div>
          <span class="eyebrow">WEB ARCADE PROTOTYPE</span>
          <h1>DEEPSEA</h1>
        </div>
        <p>Roll. Dive. Tap. Get greedy. Get back alive.</p>
      </header>
      <section class="game-layout">
        ${renderTrack()}
        ${renderControls()}
      </section>
    </main>
  `
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
  if (!action) return

  if (action === 'roll') rollDie()
  if (action === 'down') setDirection('down')
  if (action === 'up') setDirection('up')
  if (action === 'start') startBurst()
  if (action === 'collect') pickUpTreasure()
  if (action === 'reset') resetGame()
})

app.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement
  if (!target.closest('[data-action="tap"]')) return
  event.preventDefault()
  handleTap()
})

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || !state.active) return
  event.preventDefault()
  handleTap()
})

render()
