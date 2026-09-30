// __mocks__/react-native-audio-api.ts
// Root manual mock, applied automatically. The library's own mock (0.13.6) lacks
// AudioManager.setAudioSessionOptions and observeAudioInterruptions, which the adapter calls.
import type * as AudioApi from 'react-native-audio-api';

const libraryMock = jest.requireActual<typeof AudioApi>('react-native-audio-api/mock');

const audioManagerMock = {
  setAudioSessionOptions: jest.fn(),
  addSystemEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getDevicePreferredSampleRate: jest.fn(() => 48_000),
};

module.exports = { ...libraryMock, AudioManager: audioManagerMock };
