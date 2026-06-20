import {
  LiteralPrimitive,
  parseTemplate,
  TmplAstBoundAttribute,
  TmplAstText,
  TmplAstTextAttribute,
} from '@angular/compiler';
import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'src/app/agrid');
const localizationPath = resolve(sourceRoot, 'agrid-localization.ts');
const failures = [];
const userFacingAttributes = new Set(['alt', 'aria-label', 'label', 'placeholder', 'title']);
const userFacingProperties = new Set(['alt', 'ariaLabel', 'label', 'placeholder', 'title']);
const alphabeticText = /[A-Za-z\u00c0-\u024f]/u;

const files = await collectFiles(sourceRoot);
await checkLocaleDefinitions();

for (const path of files) {
  if (extname(path) === '.html') {
    checkTemplate(await readFile(path, 'utf8'), path, 0);
  } else if (path.endsWith('.ts') && !path.endsWith('.spec.ts') && path !== localizationPath) {
    checkTypeScript(await readFile(path, 'utf8'), path);
  }
}

if (failures.length > 0) {
  console.error('Localization check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nMove user-facing text to AgridLocaleText and provide English and German values.');
  process.exitCode = 1;
} else {
  console.log(`Localization check passed (${files.length} library source files checked).`);
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(path));
    else if (entry.isFile() && (path.endsWith('.html') || path.endsWith('.ts'))) result.push(path);
  }

  return result.sort();
}

async function checkLocaleDefinitions() {
  const source = await readFile(localizationPath, 'utf8');
  const file = ts.createSourceFile(localizationPath, source, ts.ScriptTarget.Latest, true);
  let interfaceKeys;
  let localeObject;

  for (const statement of file.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === 'AgridLocaleText') {
      interfaceKeys = new Map(statement.members.flatMap(member => {
        const name = propertyName(member.name);
        return name ? [[name, ts.isMethodSignature(member) ? 'function' : typeKind(member.type)]] : [];
      }));
    }

    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'AGRID_LOCALE_TEXT') {
        localeObject = unwrapObjectLiteral(declaration.initializer);
      }
    }
  }

  if (!interfaceKeys || !localeObject) {
    failures.push(`${displayPath(localizationPath)}: could not inspect AgridLocaleText definitions`);
    return;
  }

  const locales = new Map(localeObject.properties.flatMap(property => {
    if (!ts.isPropertyAssignment(property)) return [];
    const name = propertyName(property.name);
    const value = unwrapObjectLiteral(property.initializer);
    return name && value ? [[name, value]] : [];
  }));

  for (const localeName of ['en', 'de']) {
    const locale = locales.get(localeName);
    if (!locale) {
      failures.push(`${displayPath(localizationPath)}: missing ${localeName} locale`);
      continue;
    }

    const values = new Map(locale.properties.flatMap(property => {
      if (!ts.isPropertyAssignment(property)) return [];
      const name = propertyName(property.name);
      return name ? [[name, property.initializer]] : [];
    }));

    for (const [key, expectedKind] of interfaceKeys) {
      const value = values.get(key);
      if (!value) {
        failures.push(`${displayPath(localizationPath)}: ${localeName}.${key} is missing`);
        continue;
      }
      const actualKind = expressionKind(value);
      if (actualKind !== expectedKind) {
        failures.push(`${displayPath(localizationPath)}: ${localeName}.${key} must be ${expectedKind}`);
      } else if (actualKind === 'string' && value.text.trim() === '') {
        failures.push(`${displayPath(localizationPath)}: ${localeName}.${key} must not be empty`);
      }
    }

    for (const key of values.keys()) {
      if (!interfaceKeys.has(key)) {
        failures.push(`${displayPath(localizationPath)}: ${localeName}.${key} is not declared by AgridLocaleText`);
      }
    }
  }
}

function checkTypeScript(source, path) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);

  function visit(node) {
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (name === 'template' && isStaticString(node.initializer)) {
        const startLine = file.getLineAndCharacterOfPosition(node.initializer.getStart(file)).line;
        checkTemplate(node.initializer.text, path, startLine);
      } else if (name && userFacingProperties.has(name) && isAlphabeticStaticString(node.initializer)) {
        reportNode(path, file, node.initializer, `user-facing ${name} text "${shortText(node.initializer.text)}"`);
      }
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && ['innerText', 'textContent'].includes(node.left.name.text)
      && isAlphabeticStaticString(node.right)
    ) {
      reportNode(path, file, node.right, `user-facing DOM text "${shortText(node.right.text)}"`);
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const [attribute, value] = node.arguments;
      if (
        node.expression.name.text === 'setAttribute'
        && isStaticString(attribute)
        && userFacingAttributes.has(attribute.text)
        && isAlphabeticStaticString(value)
      ) {
        reportNode(path, file, value, `user-facing ${attribute.text} text "${shortText(value.text)}"`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(file);
}

function checkTemplate(source, path, lineOffset) {
  const parsed = parseTemplate(source, path, { preserveWhitespaces: true });
  for (const error of parsed.errors ?? []) {
    failures.push(`${displayPath(path)}:${lineOffset + error.span.start.line + 1}: template parse error: ${error.msg}`);
  }

  const seen = new WeakSet();
  const visit = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    if (value instanceof TmplAstText && alphabeticText.test(value.value)) {
      reportTemplate(path, lineOffset, value.sourceSpan, `literal template text "${shortText(value.value)}"`);
    }
    if (
      value instanceof TmplAstTextAttribute
      && userFacingAttributes.has(value.name)
      && alphabeticText.test(value.value)
    ) {
      reportTemplate(path, lineOffset, value.sourceSpan, `literal ${value.name} text "${shortText(value.value)}"`);
    }
    if (value instanceof TmplAstBoundAttribute && userFacingAttributes.has(value.name)) {
      const expressionSeen = new WeakSet();
      const visitExpression = expression => {
        if (!expression || typeof expression !== 'object' || expressionSeen.has(expression)) return;
        expressionSeen.add(expression);
        if (
          expression instanceof LiteralPrimitive
          && typeof expression.value === 'string'
          && alphabeticText.test(expression.value)
        ) {
          reportTemplate(
            path,
            lineOffset,
            value.sourceSpan,
            `literal text "${shortText(expression.value)}" in bound ${value.name}`,
          );
        }
        for (const child of Object.values(expression)) {
          if (Array.isArray(child)) child.forEach(visitExpression);
          else visitExpression(child);
        }
      };
      visitExpression(value.value);
    }

    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };

  parsed.nodes.forEach(visit);
}

function reportNode(path, file, node, message) {
  const position = file.getLineAndCharacterOfPosition(node.getStart(file));
  failures.push(`${displayPath(path)}:${position.line + 1}:${position.character + 1}: ${message}`);
}

function reportTemplate(path, lineOffset, span, message) {
  failures.push(`${displayPath(path)}:${lineOffset + span.start.line + 1}:${span.start.col + 1}: ${message}`);
}

function unwrapObjectLiteral(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) {
    node = node.expression;
  }
  return node && ts.isObjectLiteralExpression(node) ? node : undefined;
}

function propertyName(name) {
  if (!name) return undefined;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
}

function typeKind(type) {
  return type && ts.isFunctionTypeNode(type) ? 'function' : 'string';
}

function expressionKind(node) {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return 'function';
  return isStaticString(node) ? 'string' : 'unsupported value';
}

function isStaticString(node) {
  return Boolean(node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)));
}

function isAlphabeticStaticString(node) {
  return isStaticString(node) && alphabeticText.test(node.text);
}

function displayPath(path) {
  return relative(projectRoot, path);
}

function shortText(value) {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 80);
}
