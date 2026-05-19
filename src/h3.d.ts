interface FetchEvent extends Event {
  respondWith(response: Response | Promise<Response>): void
}
