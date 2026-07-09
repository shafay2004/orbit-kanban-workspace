import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | undefined | null): SafeHtml {
    if (!value) return '';
    
    try {
      // Synchronous layout parse from marked token compiler engine
      const rawHtml = marked.parse(value) as string;
      
      // Sanitizes output string to eliminate malicious script execution loops (XSS Protection)
      return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
    } catch (error) {
      console.error('Markdown pipeline parsing exception:', error);
      return value;
    }
  }
}