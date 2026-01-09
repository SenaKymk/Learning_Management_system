export class ApiRequestError extends Error {
  status: number | null;
  isNetwork: boolean;

  constructor(message: string, status: number | null, isNetwork: boolean) {
    super(message);
    this.status = status;
    this.isNetwork = isNetwork;
  }
}
