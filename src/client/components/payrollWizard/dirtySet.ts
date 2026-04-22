// src/client/components/payrollWizard/dirtySet.ts
// Tracks which (workerId, classificationId) rows have unsaved edits.
// drain() atomically returns + clears — call it inside a debounced flush.

export class DirtySet {
  private keys = new Set<string>();

  private pack(workerId: string, classificationId: string): string {
    return `${workerId}::${classificationId}`;
  }

  add(workerId: string, classificationId: string): void {
    this.keys.add(this.pack(workerId, classificationId));
  }

  has(workerId: string, classificationId: string): boolean {
    return this.keys.has(this.pack(workerId, classificationId));
  }

  size(): number {
    return this.keys.size;
  }

  drain(): Array<{ workerId: string; classificationId: string }> {
    const out: Array<{ workerId: string; classificationId: string }> = [];
    for (const packed of this.keys) {
      const [workerId, classificationId] = packed.split('::');
      out.push({ workerId, classificationId });
    }
    this.keys.clear();
    return out;
  }
}
