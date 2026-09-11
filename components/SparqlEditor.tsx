"use client";

import { useEffect, useRef } from "react";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { sparql } from "@codemirror/legacy-modes/mode/sparql";
import { oneDark } from "@codemirror/theme-one-dark";
import { fetchOntologyTerms, type OntologyTerm } from "@/lib/ontologyTerms";
import { sparqlCompletionSource } from "@/lib/sparqlCompletion";

// Modulnivå: samme Language-instans må brukes både som editor-extension og
// for .data.of(...) under, ellers plukkes ikke fullførings-kilden opp.
const sparqlLanguage = StreamLanguage.define(sparql);

type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
};

export default function SparqlEditor({ value, onChange, onRun }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  // Hold ferske callbacks uten å bygge editoren på nytt.
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;
  const termsRef = useRef<OntologyTerm[]>([]);

  useEffect(() => {
    fetchOntologyTerms().then((terms) => {
      termsRef.current = terms;
    });
  }, []);

  useEffect(() => {
    if (!host.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        sparqlLanguage,
        sparqlLanguage.data.of({
          autocomplete: sparqlCompletionSource(() => termsRef.current),
        }),
        oneDark,
        EditorView.lineWrapping,
        // Prec.highest slår basicSetup sin defaultKeymap, som ellers binder
        // Mod-Enter til «sett inn blank linje».
        Prec.highest(
          keymap.of([
            {
              key: "Mod-Enter",
              preventDefault: true,
              run: () => {
                onRunRef.current();
                return true;
              },
            },
          ]),
        ),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });

    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ytre endringer (fane-bytte, innsatte prefikser) speiles inn i editoren.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (value !== current) {
      v.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={host} className="h-full overflow-auto" />;
}
