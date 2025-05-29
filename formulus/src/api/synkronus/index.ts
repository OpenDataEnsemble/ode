import { Configuration, DefaultApi } from './generated'
import AsyncStorage from '@react-native-async-storage/async-storage'

let synkronusApi: DefaultApi | null = null

export const getSynkronusApi = async (): Promise<DefaultApi> => {
  if (synkronusApi) return synkronusApi

  const rawSettings = await AsyncStorage.getItem('@settings')
  if (!rawSettings) throw new Error('Missing app settings')

  const { serverUrl } = JSON.parse(rawSettings)

  const config = new Configuration({
    basePath: serverUrl,
    accessToken: async () => {
      const token = await AsyncStorage.getItem('@token')
      return token || ''
    },
  })

  synkronusApi = new DefaultApi(config)
  return synkronusApi
}