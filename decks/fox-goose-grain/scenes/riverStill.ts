import { defineScene } from 'dotscene'
import { ASPECT, FLOOR } from '../../../figures/kit.ts'
import { boat } from '../figures/props.ts'
import { CAMERA, CAST, DOCK, LAND, sceneCss } from './river.ts'

/**
 * The same bank before anyone arrives: plain SVG with nothing to animate, for the slide that
 * holds while the room settles. A static scene is cued as `{ scene }`, with no mark.
 */
export const scene = defineScene('riverStill', {
  title: 'A fox, a goose and a bag of grain wait on a river bank beside a moored boat',
  decorative: true,
  parts: [...LAND, ...CAST, { figure: boat, id: 'boat', at: [DOCK.left, FLOOR] }],
  camera: { ...CAMERA, aspect: ASPECT },
  fit: 'slice',
  dotRadius: 1.15,
  lineWidth: 0.6,
  css: sceneCss,
})
