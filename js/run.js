var inputArea = document.getElementById("csc-input"),
    outputArea = document.getElementById("variant-calls"),
    inputDiv = document.getElementById("input"),
    outputDiv = document.getElementById("output"),
    runButton = document.getElementById("run-button"),
    resetButton = document.getElementById("reset-button");


const variantCache = new Map();


function reset() {
    // Clear data
    outputArea.value = "";
    inputArea.value = "";
    outputDiv.classList.add("hidden");
    inputDiv.classList.remove("hidden");
}


async function run() {
    inputDiv.classList.add("hidden");
    // TODO: show progress bar?
    let csv = inputArea.value;
    let parsed = Papa.parse(csv, { header: true });
    let samples = new Map();
    parsed.data.forEach((row) => {
        let mutations = [];
        Object.keys(row).forEach((key) => {
            if (key == "sample" || key == "comment") {
                return;
            }
            if (row[key] == "1") {
                mutations.push(`S:${key}`);
            };
        });
        samples.set(row["sample"], mutations.join(","));
    });
    let variants = await callVariants(samples);
    let lines = [];
    variants.forEach((variantCall) => {
        let names = [];
        variantCall.variants.forEach((variant) => {
            names.push(`(${variant.pangolin_lineage}, ${Math.round(variant.proportion * 1000) / 10} %)`);
        });
        lines.push(`${variantCall.sample}: ${variantCall.mutations}; ${names.join(", ")}`);
    });
    outputArea.value = lines.join("\n");
    outputDiv.classList.remove("hidden");
}


async function callVariants(samples) {
    let variants = [];
    for (const [sample, mutations] of samples) {
        if (!variantCache.has(mutations)) {
            let encodedMutations = encodeURIComponent(mutations);
            let result = await fetch(`https://api.outbreak.info/genomics/mutations-by-lineage?mutations=${encodedMutations}`);
            if (!result.ok) {
                console.error(result.statusText);
                continue;
            }
            let data = await result.json();
            if (!data.success) {
                console.error(data);
                continue
            }
            let lineages = data.results;
            lineages.sort((a, b) => {
                return b.proportion - a.proportion;
            });
            variantCache.set(mutations, lineages);
        }
        variants.push({sample: sample, mutations: mutations, variants: variantCache.get(mutations)});
    }
    console.log(variants);
    return variants;
}


resetButton.addEventListener("click", reset);
runButton.addEventListener("click", run);
