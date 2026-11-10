import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import storage from "./storage";
import userReducer from "./userSlice";

// Only the cached profile is persisted — NOT authUser/status. A persisted
// authUser made pages start Firestore listeners (users/{uid}, wallets/{uid},
// transaction_totals/{uid}…) on reload before Firebase Auth had restored the
// session, so they ran unauthenticated and failed with permission-denied
// (users/{uid} needs sign-in — giggre_app firestore.rules). authUser now
// comes only from onAuthStateChanged (ReduxProvider), i.e. once Firestore
// requests carry the user's token. New key so old persisted authUser data
// isn't rehydrated.
const persistedReducer = combineReducers({
  user: persistReducer({ key: "giggre-user-v2", storage, blacklist: ["authUser", "status"] }, userReducer),
});

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist dispatches non-serializable actions during rehydration.
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
