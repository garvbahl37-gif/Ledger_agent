# Paper

`ledger.tex` builds with [Tectonic](https://tectonic-typesetting.github.io) or
any standard LaTeX toolchain:

```bash
tectonic -X compile ledger.tex
```

Figures are **generated from the raw results**, never drawn by hand:

```bash
cd ../backend
python eval/make_figures.py eval/results ../paper/figures
```

so a figure cannot drift from the experiment that produced it. To reproduce the
numbers in the paper from scratch:

```bash
cd backend
python -m eval.run_eval --nullset 200 --planted 240 --nuisance 40 --out eval/results
python -m eval.run_registry_eval --nullset 25 --planted 25 --out eval/results   # needs a model
python eval/make_figures.py eval/results ../paper/figures
```

The deterministic suites need no model and take about 25 seconds. The registry
arms make one LLM call per table.
