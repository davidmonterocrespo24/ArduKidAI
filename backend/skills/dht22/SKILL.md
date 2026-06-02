---
name: dht22
description: Use whenever the circuit reads temperature or humidity from a DHT22 sensor. Covers the exact wire() pin names (VCC, SDA, NC, GND), the single data pin, and the DHT temperature/humidity blocks.
---

# DHT22 temperature + humidity

A digital sensor that reports both temperature (in Celsius) and relative
humidity over a single data line.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `SDA` - data (wire it to a digital pin, e.g. `UNO.D2`).
- `NC` - not connected (leave unwired).
- `GND` - ground (wire it to `UNO.GND`).

## Correct wiring

```
wire("DHT<n>.VCC", "UNO.5V")
wire("DHT<n>.SDA", "UNO.D2")
wire("DHT<n>.GND", "UNO.GND")
```

## Blocks

- Read temperature with `ardukid_dht_temperature` (field `PIN` = the data pin,
  e.g. `2`).
- Read humidity with `ardukid_dht_humidity` (field `PIN` = the same data pin).
- These return numbers; print them to an LCD/OLED or compare them.

## Gotchas

- `SDA` is the data pin, not an I2C bus. Set field `PIN` to that same digital
  pin (e.g. 2 if wired to `UNO.D2`).
- `NC` stays unwired; do not connect it.

## Best practices

- Use the same digital pin in both the wire and the block `PIN` field.
- The DHT22 is slow; read it about once per second, not every loop tick.
