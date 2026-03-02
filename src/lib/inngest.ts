import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'fanout',
  eventKey: process.env.INNGEST_EVENT_KEY,
})
