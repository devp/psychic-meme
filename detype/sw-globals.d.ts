// importScripts() globals aren't typed for you -- a real cost of the classic
// service worker + bundled-runtime shape. Narrow to what sw.js actually uses.
import type {
  precacheAndRoute,
  createHandlerBoundToURL,
} from "workbox-precaching";
import type { registerRoute, NavigationRoute } from "workbox-routing";

declare global {
  const workbox: {
    precacheAndRoute: typeof precacheAndRoute;
    createHandlerBoundToURL: typeof createHandlerBoundToURL;
    registerRoute: typeof registerRoute;
    NavigationRoute: typeof NavigationRoute;
  };
  interface WorkerGlobalScope {
    __PRECACHE: { url: string; revision: string | null }[];
  }
}
