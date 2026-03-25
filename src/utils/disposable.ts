import type { Disposable } from "vscode";

export class DisposableCollection implements Disposable {
  private readonly items: Disposable[] = [];

  add<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  dispose(): void {
    for (const item of this.items) {
      item.dispose();
    }
    this.items.length = 0;
  }
}
