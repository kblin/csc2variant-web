var inputArea = document.getElementById("csc-input"),
    outputTable = document.getElementById("variant-calls"),
    inputDiv = document.getElementById("input"),
    runningDiv = document.getElementById("running"),
    outputDiv = document.getElementById("output"),
    runButton = document.getElementById("run-button"),
    progressBar = document.getElementById("progress"),
    resetButton = document.getElementById("reset-button"),
    tableTemplate = document.getElementById("variant-row");


const variantCache = new Map();


function reset() {
    // Clear data
    outputTable.innerHTML = "";
    inputArea.value = "";
    outputDiv.classList.add("hidden");
    inputDiv.classList.remove("hidden");
}


async function run() {
    inputDiv.classList.add("hidden");
    runningDiv.classList.remove("hidden");

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
    variants.forEach((variantCall) => {
        let names = [];
        variantCall.variants.forEach((variant) => {
            let fixedName = variant.pangolin_lineage[0].toUpperCase() + variant.pangolin_lineage.substr(1);
            names.push(`${fixedName} (${Math.round(variant.proportion * 1000) / 10} %)`);
        });
        let clone = tableTemplate.content.firstElementChild.cloneNode(true);
        let td = clone.querySelectorAll("td");
        td[0].textContent = variantCall.sample;
        td[1].textContent = variantCall.mutations;
        td[2].textContent = names.join(", ");
        clone.addEventListener("click", () => {
            window.open(getSitRepUrl(variantCall.mutations), "_blank");
        });
        outputTable.appendChild(clone);
    });

    runningDiv.classList.add("hidden");
    outputDiv.classList.remove("hidden");
}


function getSitRepUrl(mutations) {
    let mut_components = [];
    mutations.split(",").forEach((mut) => {
        mut_components.push(`muts=${encodeURIComponent(mut)}`);
    });
    return `https://outbreak.info/situation-reports?pango&${mut_components.join("&")}`;
}


async function callVariants(samples) {
    let variants = [];
    let counter = 0;
    for (const [sample, mutations] of samples) {
        if (!variantCache.has(mutations)) {
            counter++;
            let encodedMutations = encodeURIComponent(mutations);
            let result = await fetch(`https://api.outbreak.info/genomics/mutations-by-lineage?mutations=${encodedMutations}`);
            progressBar.MaterialProgress.setProgress((counter / samples.length) * 100);
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
    return variants;
}


resetButton.addEventListener("click", reset);
runButton.addEventListener("click", run);
