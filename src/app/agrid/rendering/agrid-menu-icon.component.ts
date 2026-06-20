import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
    selector: 'agrid-menu-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [],
    styles: [`
        :host {
            display: inline-flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            min-width: 14px;
            line-height: 1;
        }
    `],
    // Using a fallback empty string prevents 'undefined' from rendering as a string in the HTML
    host: { 
        '[class]': 'class() || ""' 
    },
    template: `<span aria-hidden="true"><ng-content></ng-content></span>`
})
export class AgridMenuBarIcon {
    class = input<string>();
}