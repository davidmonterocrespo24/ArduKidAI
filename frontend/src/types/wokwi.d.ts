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
      'wokwi-lcd1602': WokwiElement<{ text?: string }>
      'wokwi-7segment': WokwiElement<{ values?: string; color?: string }>
    }
  }
}
