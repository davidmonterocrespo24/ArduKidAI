import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type WokwiElement<P = Record<string, unknown>> = DetailedHTMLProps<
  HTMLAttributes<HTMLElement> & P,
  HTMLElement
>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'wokwi-arduino-uno': WokwiElement
      'wokwi-led': WokwiElement<{
        color?: string
        brightness?: number
        value?: boolean
      }>
      'wokwi-pushbutton': WokwiElement<{
        color?: string
        label?: string
        pressed?: boolean
      }>
      'wokwi-resistor': WokwiElement<{ value?: string }>
      'wokwi-buzzer': WokwiElement<{ hasSignal?: boolean }>
      'wokwi-servo': WokwiElement<{ angle?: number }>
      'wokwi-potentiometer': WokwiElement<{ value?: number }>
      'wokwi-lcd1602': WokwiElement<{ text?: string; pins?: 'full' | 'i2c' | 'none' }>
      'wokwi-lcd2004': WokwiElement<{ text?: string; pins?: 'full' | 'i2c' | 'none' }>
      'wokwi-dip-switch-8': WokwiElement<{ values?: number[] }>
      'wokwi-analog-joystick': WokwiElement<{
        xValue?: number
        yValue?: number
        pressed?: boolean
      }>
      'wokwi-big-sound-sensor': WokwiElement
      'wokwi-flame-sensor': WokwiElement<{ ledPower?: boolean; ledSignal?: boolean }>
      'wokwi-ky-040': WokwiElement<{ angle?: number; stepSize?: number }>
      'wokwi-7segment': WokwiElement<{ values?: number[] | string; color?: string }>
      'wokwi-pushbutton-6mm': WokwiElement<{ color?: string; pressed?: boolean }>
      'wokwi-slide-potentiometer': WokwiElement<{ value?: number; min?: number; max?: number }>
      'wokwi-slide-switch': WokwiElement<{ value?: number }>
      'wokwi-photoresistor-sensor': WokwiElement<{ value?: number }>
      'wokwi-ntc-temperature-sensor': WokwiElement<{ temperature?: number }>
      'wokwi-tilt-switch': WokwiElement<{ tilted?: boolean }>
      'wokwi-pir-motion-sensor': WokwiElement<{ value?: boolean }>
      'wokwi-rgb-led': WokwiElement<{
        ledRed?: number
        ledGreen?: number
        ledBlue?: number
      }>
      'wokwi-led-bar-graph': WokwiElement<{
        color?: string
        values?: number[]
      }>
    }
  }
}
