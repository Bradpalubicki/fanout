import { SquareClient, SquareEnvironment } from 'square'

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN ?? '',
  environment:
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
})

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 4900, // cents
    display: '$49',
    locationId: process.env.SQUARE_LOCATION_ID ?? '',
  },
  agency: {
    name: 'Agency',
    price: 19900,
    display: '$199',
    locationId: process.env.SQUARE_LOCATION_ID ?? '',
  },
  'white-label': {
    name: 'White-Label',
    price: 39900,
    display: '$399',
    locationId: process.env.SQUARE_LOCATION_ID ?? '',
  },
} as const

export type PlanKey = keyof typeof PLANS
