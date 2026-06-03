/**
 * Single source of truth for where a freshly added peripheral should land on
 * the stage. Both the manual "Add" toolbar (ComponentPicker) and the agent
 * dispatcher use it so manual and agent-driven adds spread on the same grid
 * and never stack on top of each other.
 */

// Wide enough for the biggest parts (I2C LCD / OLED ~200 px) so parts never
// overlap, and only two columns so they stay left of the pinned board.
const SPAWN_GRID_X = 210
const SPAWN_GRID_Y = 140
const SPAWN_ORIGIN_X = 20
const SPAWN_ORIGIN_Y = 20
const SPAWN_COLS = 2

export function nextSpawnPosition(existingPeripheralCount: number): { x: number; y: number } {
  const col = existingPeripheralCount % SPAWN_COLS
  const row = Math.floor(existingPeripheralCount / SPAWN_COLS)
  return {
    x: SPAWN_ORIGIN_X + col * SPAWN_GRID_X,
    y: SPAWN_ORIGIN_Y + row * SPAWN_GRID_Y,
  }
}
