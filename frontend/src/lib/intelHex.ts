/**
 * Minimal Intel HEX parser for AVR program memory. Handles record types 00
 * (data) and 01 (EOF); ignores extended-address records (04, 05) since
 * Arduino UNO sketches always fit in the first 32 KB.
 */

export function parseIntelHex(hex: string): Uint8Array {
  let highest = 0
  const bytes = new Uint8Array(0x10000)
  for (const rawLine of hex.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith(':')) continue
    const count = parseInt(line.substring(1, 3), 16)
    const address = parseInt(line.substring(3, 7), 16)
    const recordType = parseInt(line.substring(7, 9), 16)
    if (recordType === 0x01) break
    if (recordType !== 0x00) continue
    for (let i = 0; i < count; i++) {
      const byte = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16)
      bytes[address + i] = byte
      if (address + i > highest) highest = address + i
    }
  }
  return bytes.slice(0, highest + 1)
}

export function bytesToProgramWords(bytes: Uint8Array, capacityWords = 0x4000): Uint16Array {
  const words = new Uint16Array(capacityWords)
  const wordCount = Math.min(Math.ceil(bytes.length / 2), capacityWords)
  for (let i = 0; i < wordCount; i++) {
    const lo = bytes[i * 2] ?? 0
    const hi = bytes[i * 2 + 1] ?? 0
    words[i] = lo | (hi << 8)
  }
  return words
}
