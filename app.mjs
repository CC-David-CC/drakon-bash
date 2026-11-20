import { mountStudio } from './runtime/studio.mjs';
import { generate } from './runtime/compiler.mjs';
import { language } from './language.mjs';

export function mount(host) {
  return mountStudio(host, language);
}
export function generateSource(project) {
  return generate(project, language);
}
