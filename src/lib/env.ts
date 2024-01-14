export interface EnvSystem {
  isLocal: boolean
  clientID: string
  clientSecret: string
  now: () => number
}

const system: EnvSystem = {
  isLocal: false,
  clientID: "",
  clientSecret: "",
  now: () => Date.now(),
}

export default system
