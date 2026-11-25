declare module "h5p-standalone" {
  /** The standalone H5P player (MIT). Plays an unpacked H5P game inside `el`. */
  export class H5P {
    constructor(el: HTMLElement, options: Record<string, unknown>);
    then<T>(cb: () => T): Promise<T>;
  }
}
