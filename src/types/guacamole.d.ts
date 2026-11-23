declare module "guacamole-common-js" {
  // The package ships no types; the subset used by the RDP viewer is typed loosely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Guacamole: any;
  export default Guacamole;
}
