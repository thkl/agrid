import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
    selector: 'agrid-menu-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [],
    styleUrls: ['./agrid-menu-icon.component.css'],
    templateUrl: 'agrid-menu-icon.component.html',
    // Using a fallback empty string prevents 'undefined' from rendering as a string in the HTML
    host: { 
        '[class]': 'class() || ""' 
    },
})
export class AgridMenuBarIcon {
    class = input<string>();
}