import { Progress } from '../progress';
import { PlaygroundTest } from './api';

export class NavigationTest extends PlaygroundTest {
  protected async _run(progress: Progress): Promise<void> {
    const browser = await this.context.getBrowser(progress);
    const page = await this.context.newPage(browser, progress);
    await this.context.navigate(page, progress);
  }
}
