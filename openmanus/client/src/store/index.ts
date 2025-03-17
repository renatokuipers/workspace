// openmanus/client/src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import toolsReducer from './slices/toolsSlice';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['tools'],
  blacklist: [] // Add this to explicitly show what we're not persisting
};

const persistedReducer = persistReducer(persistConfig, toolsReducer);

export const store = configureStore({
  reducer: {
    tools: persistedReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    })
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;