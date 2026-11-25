/**
 * True only after this sign-in has merged (or confirmed) the account cart.
 * Until then, cart reads stay on the guest session so a failed merge is not
 * replaced by an empty account cart.
 */
let linked = false;

export function accountCartLinked(): boolean {
  return linked;
}

export function setAccountCartLinked(value: boolean) {
  linked = value;
}
