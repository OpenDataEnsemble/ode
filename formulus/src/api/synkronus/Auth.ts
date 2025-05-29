import { getSynkronusApi } from './index'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const login = async (username: string, password: string) => {
    console.log('Logging in with', username, password)
    const api = await getSynkronusApi()

    const res = await api.authLoginPost({
        authLoginPostRequest: { username, password },
    })

    const { token, refreshToken, expiresAt } = res.data

    await AsyncStorage.setItem('@token', token)
    await AsyncStorage.setItem('@refreshToken', refreshToken)
    await AsyncStorage.setItem('@tokenExpiresAt', expiresAt.toString())

    return true
}