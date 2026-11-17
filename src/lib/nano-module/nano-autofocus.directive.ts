import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, PLATFORM_ID, inject } from '@angular/core';

/**
 * Internal directive: moves focus into an inline `<input>` when it is rendered
 * (API_CONTRACT.md §5). Not exported from the public API.
 */
@Directive({ selector: 'input[nanoAutofocus]' })
export class NanoAutofocusDirective implements AfterViewInit {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.element.nativeElement.focus();
    }
  }
}
