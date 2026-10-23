export class ApplicationUtils {
  private sensitive_data: string[];
  
  constructor(){
        this.sensitive_data = ["senha_hash"]
  }

  hideSensitiveInputs<T>(register: unknown): T {
    if (!register || typeof register !== "object") return register as T;
    const copy: Record<string, unknown> = {
      ...(register as Record<string, unknown>),
    };

    for (const input of this.sensitive_data) {
      delete copy[input];
    }

    return copy as T;
  }
}
