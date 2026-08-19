import { Component, EventEmitter, HostListener, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

export interface DocChapter {
  id: string;
  title: string;
  file: string;
  content?: string;
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

@Component({
  selector: 'app-help-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './help-modal.component.html',
  styleUrls: ['./help-modal.component.css']
})
export class HelpModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  chapters = signal<DocChapter[]>([]);
  activeChapterId = signal<string>('introduction');
  renderedHtml = signal<string>('');
  tocItems = signal<TocItem[]>([]);
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadManifest();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isOpen) return;
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }

  closeModal() {
    this.close.emit();
  }

  private loadManifest() {
    this.http.get<DocChapter[]>('docs/manifest.json').subscribe({
      next: (data) => {
        this.chapters.set(data);
        if (data.length > 0) {
          this.selectChapter(data[0].id);
        }
      },
      error: () => {
        this.chapters.set([
          { id: 'introduction', title: '1. Введение и интерфейс', file: 'docs/01_introduction.md' },
          { id: 'map-layers', title: '2. Картоснова и слои', file: 'docs/02_map_layers.md' },
          { id: 'tactical-symbols', title: '3. Тактическая обстановка', file: 'docs/03_tactical_symbols.md' },
          { id: 'analysis-tools', title: '4. Измерения и анализ', file: 'docs/04_analysis_tools.md' },
          { id: 'march-planner', title: '5. Расчет марша и походного порядка', file: 'docs/05_march_planner.md' },
          { id: 'fortification', title: '6. Калькулятор фортификации', file: 'docs/06_fortification.md' },
          { id: 'export-print', title: '7. Экспорт и печать карт', file: 'docs/07_export_print.md' }
        ]);
        this.selectChapter('introduction');
      }
    });
  }

  selectChapter(chapterId: string) {
    const chapter = this.chapters().find((c: DocChapter) => c.id === chapterId);
    if (!chapter) return;

    this.activeChapterId.set(chapterId);
    this.isLoading.set(true);

    this.http.get(chapter.file, { responseType: 'text' }).subscribe({
      next: (mdText) => {
        this.parseAndSetMarkdown(mdText);
        this.isLoading.set(false);
      },
      error: () => {
        this.renderedHtml.set('<p class="error-msg">Ошибка загрузки файла справки.</p>');
        this.tocItems.set([]);
        this.isLoading.set(false);
      }
    });
  }

  get filteredChapters(): DocChapter[] {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.chapters();
    return this.chapters().filter((c: DocChapter) => c.title.toLowerCase().includes(q));
  }

  scrollToToc(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private parseAndSetMarkdown(md: string) {
    const toc: TocItem[] = [];
    let html = md;

    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html.replace(/^### (.*?)$/gm, (match, title) => {
      const slug = 'heading-' + Math.random().toString(36).substring(2, 9);
      toc.push({ id: slug, text: title.trim(), level: 3 });
      return `<h3 id="${slug}">${title.trim()}</h3>`;
    });

    html = html.replace(/^## (.*?)$/gm, (match, title) => {
      const slug = 'heading-' + Math.random().toString(36).substring(2, 9);
      toc.push({ id: slug, text: title.trim(), level: 2 });
      return `<h2 id="${slug}">${title.trim()}</h2>`;
    });

    html = html.replace(/^# (.*?)$/gm, (match, title) => {
      return `<h1 class="doc-title">${title.trim()}</h1>`;
    });

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/^\-\-\-$/gm, '<hr class="doc-hr"/>');

    html = html.replace(/^[\-\*] (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');

    const paragraphs = html.split('\n\n');
    html = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<hr')) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    }).join('\n');

    this.renderedHtml.set(html);
    this.tocItems.set(toc);
  }
}
