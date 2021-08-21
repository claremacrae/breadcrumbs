import {
  App,
  ButtonComponent,
  DropdownComponent,
  Notice,
  PluginSettingTab,
  Setting,
} from "obsidian";
import {
  ALLUNLINKED,
  REAlCLOSED,
  RELATIONS,
  VIEW_TYPE_BREADCRUMBS_MATRIX,
  VISTYPES,
} from "src/constants";
import type { Relations, userHierarchy, visTypes } from "src/interfaces";
import type BreadcrumbsPlugin from "src/main";
import { hierToStr, isInVault, splitAndTrim } from "src/sharedFunctions";
import { isEqual } from "lodash";
import KoFi from "./Components/KoFi.svelte";

export class BreadcrumbsSettingTab extends PluginSettingTab {
  plugin: BreadcrumbsPlugin;

  constructor(app: App, plugin: BreadcrumbsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const plugin = this.plugin;
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Settings for Breadcrumbs plugin" });

    function hierIndex(
      currHiers: userHierarchy[],
      values: [string[], string[], string[]]
    ) {
      return currHiers.findIndex(
        (hier) =>
          isEqual(hier.up, values[0]) &&
          isEqual(hier.same, values[1]) &&
          isEqual(hier.down, values[2])
      );
    }

    const addHierarchyRow = (
      values: userHierarchy = { up: ["↑"], same: ["→"], down: ["↓"] },
      existing = false
    ) => {
      const row = createSpan({ cls: "hierarchy-row" });

      const hierarchyNames = row.createSpan({});

      hierarchyNames.createEl("label", { attr: { for: "up" }, text: "↑" });
      const upInput = hierarchyNames.createEl("input", {
        attr: { id: "up" },
        value: values.up.join(", "),
      });
      hierarchyNames.createEl("label", { attr: { for: "same" }, text: "→" });
      const sameInput = hierarchyNames.createEl("input", {
        attr: { id: "same" },
        value: values.same.join(", "),
      });
      hierarchyNames.createEl("label", { attr: { for: "down" }, text: "↓" });
      const downInput = hierarchyNames.createEl("input", {
        attr: { id: "down" },
        value: values.down.join(", "),
      });
      let cleanInputs = [upInput.value, sameInput.value, downInput.value].map(
        splitAndTrim
      ) as [string[], string[], string[]];

      [upInput, sameInput, downInput].forEach((input) =>
        input.addEventListener("change", () => {
          saveButton.toggleClass("hierarchy-unsaved", true);
          saveButton.textContent = "Save";
        })
      );

      const deleteButton = row.createEl("button", { text: "X" }, (el) => {
        el.addEventListener("click", async () => {
          row.remove();
          const removeIndex = hierIndex(
            plugin.settings.userHierarchies,
            [upInput.value, sameInput.value, downInput.value].map(
              splitAndTrim
            ) as [string[], string[], string[]]
          );

          if (removeIndex > -1) {
            plugin.settings.userHierarchies.splice(removeIndex, 1);
            await plugin.saveSettings();
          }
          new Notice("Hierarchy Removed.");
        });
      });

      const saveButton = row.createEl(
        "button",
        {
          text: existing ? "Saved" : "Save",
          cls: (existing ? "" : "hierarchy-unsaved ") + "save-hierarchy-button",
        },
        function (el) {
          el.addEventListener("click", async () => {
            if (
              hierIndex(
                plugin.settings.userHierarchies,
                [upInput.value, sameInput.value, downInput.value].map(
                  splitAndTrim
                ) as [string[], string[], string[]]
              ) > -1
            ) {
              new Notice(
                "A hierarchy with these Up, Same, and Down values already exists."
              );
              return;
            }
            if (saveButton.hasClass("hierarchy-unsaved")) {
              const removeIndex = hierIndex(
                plugin.settings.userHierarchies,
                cleanInputs
              );

              if (removeIndex > -1) {
                plugin.settings.userHierarchies.splice(removeIndex, 1);
                await plugin.saveSettings();
              }
            }
            cleanInputs = [upInput.value, sameInput.value, downInput.value].map(
              splitAndTrim
            ) as [string[], string[], string[]];

            saveButton.toggleClass("hierarchy-unsaved", false);
            saveButton.textContent = "Saved";

            if (hierIndex(plugin.settings.userHierarchies, cleanInputs) > -1) {
              new Notice(
                "A hierarchy with these Up, Same, and Down values already exists."
              );
            } else {
              plugin.settings.userHierarchies.push({
                up: splitAndTrim(upInput.value),
                same: splitAndTrim(sameInput.value),
                down: splitAndTrim(downInput.value),
              });
              await plugin.saveSettings();
              new Notice("Hierarchy saved.");
            }
          });
        }
      );

      return row;
    };

    const fieldDetails: HTMLDetailsElement = containerEl.createEl("details", {
      cls: "field-details",
    });
    fieldDetails.createEl("summary", { text: "Hierarchies" });

    fieldDetails.createEl("p", {
      text: "Here you can set up different hierarchies you use in your vault. To add a new hierarchy, click the plus button. Then, fill in the field names of your hierachy into the 3 boxes that appear. The ↑ field is for parent relations, the → field is for siblings, and ↓ is for child relations.",
    });
    fieldDetails.createEl("p", {
      text: "For each direction (up, same, down), you can enter multiple field names in a comma seperated list. For example: `parent, broader, upper`",
    });

    new Setting(fieldDetails)
      .setName("Add Hierarchy")
      .setDesc("Add a new hierarchy.")
      .addButton((button: ButtonComponent) => {
        let b = button
          .setTooltip("Add Additional")
          .setButtonText("+")
          .onClick(async () => {
            fieldDetails.append(addHierarchyRow());
          });
      });

    fieldDetails.createEl(
      "button",
      { text: "Reset Hierarchies" },
      async (el) => {
        el.addEventListener("click", async () => {
          const rows = fieldDetails.querySelectorAll(".hierarchy-row");
          rows.forEach((row) => row.remove());
          plugin.settings.userHierarchies = [];
          await plugin.saveSettings();
          new Notice("Hierarchies reset.");
        });
      }
    );

    fieldDetails.createEl("button", { text: "Show Hierarchies" }, (el) => {
      el.addEventListener("click", () => {
        if (plugin.settings.userHierarchies.length) {
          new Notice(
            plugin.settings.userHierarchies.map(hierToStr).join("\n\n")
          );
        } else {
          new Notice("No hierarchies currently exist.");
        }
        console.log({ hierarchies: plugin.settings.userHierarchies });
      });
    });

    plugin.settings.userHierarchies.forEach((userHier) => {
      fieldDetails.append(addHierarchyRow(userHier, true));
    });

    const hierarchyNoteDetails: HTMLDetailsElement =
      containerEl.createEl("details");
    hierarchyNoteDetails.createEl("summary", { text: "Hierarchy Notes" });

    new Setting(hierarchyNoteDetails)
      .setName("Hierarchy Note(s)")
      .setDesc("A list of notes used to create external breadcrumb structures.")
      .addText((text) => {
        let finalValue: string[];
        text
          .setPlaceholder("Hierarchy Note(s)")
          .setValue([plugin.settings.hierarchyNotes].flat().join(", "))
          .onChange(async (value) => {
            finalValue = splitAndTrim(value);
          });

        text.inputEl.onblur = async () => {
          if (finalValue[0] === "") {
            plugin.settings.hierarchyNotes = finalValue;
            await plugin.saveSettings();
          } else if (finalValue.every((note) => isInVault(this.app, note))) {
            plugin.settings.hierarchyNotes = finalValue;
            await plugin.saveSettings();
          } else {
            new Notice("Atleast one of the notes is not in your vault");
          }
        };
      });

    new Setting(hierarchyNoteDetails)
      .setName("Hierarchy Note Field Name")
      .setDesc(
        "Using the breadcrumbs generated by the hierarchy note, which ↓ type should they count as? This has to be a of the ↓ types of one of your exisiting hierarchies. If you want it to be something else, you can make a new hierarchy just for it."
      )
      .addText((text) => {
        let finalValue: string;
        text
          .setPlaceholder("Hierarchy Note(s)")
          .setValue(plugin.settings.hierarchyNoteFieldName)
          .onChange(async (value) => {
            finalValue = value;
          });

        text.inputEl.onblur = async () => {
          if (finalValue === "") {
            plugin.settings.hierarchyNoteFieldName = finalValue;
            await plugin.saveSettings();
          } else {
            const downFieldNames = plugin.settings.userHierarchies
              .map((hier) => hier.down)
              .flat();

            if (downFieldNames.includes(finalValue)) {
              plugin.settings.hierarchyNoteFieldName = finalValue;
              await plugin.saveSettings();
            } else {
              new Notice(
                "The field name must be one of the exisitng ↓ fields in your hierarchies."
              );
            }
          }
        };
      });

    const generalDetails: HTMLDetailsElement = containerEl.createEl("details");
    generalDetails.createEl("summary", { text: "General Options" });

    new Setting(generalDetails)
      .setName("Refresh Index on Note Change")
      .setDesc(
        "Refresh the Breadcrumbs index data everytime you change notes. This is how Breadcrumbs used to work, making it responsive to changes immediately after changing notes. However, this can be very slow on large vaults, so it is off by default."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.refreshIndexOnActiveLeafChange)
          .onChange(async (value) => {
            plugin.settings.refreshIndexOnActiveLeafChange = value;
            await plugin.saveSettings();
          })
      );

    new Setting(generalDetails)
      .setName("Use yaml or inline fields for hierarchy data")
      .setDesc(
        "If enabled, Breadcrumbs will make it's hierarchy using yaml fields, and inline fields (if you have Dataview enabled). If this is disabled, it will only use Juggl links for it's metadata (See below)."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.useAllMetadata)
          .onChange(async (value) => {
            plugin.settings.useAllMetadata = value;
            await plugin.saveSettings();
            await plugin.refreshIndex();
          })
      );

    new Setting(generalDetails)
      .setName("Use Juggl link syntax without having Juggl installed.")
      .setDesc(
        "Should Breadcrumbs look for [Juggl links](https://juggl.io/Link+Types) even if you don't have Juggl installed? If you do have Juggl installed, it will always look for Juggl links."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.parseJugglLinksWithoutJuggl)
          .onChange(async (value) => {
            plugin.settings.parseJugglLinksWithoutJuggl = value;
            await plugin.saveSettings();
          })
      );

    if (this.app.plugins.plugins.dataview !== undefined) {
      new Setting(generalDetails)
        .setName("Dataview Wait Time")
        .setDesc(
          'Enter an integer number of seconds to wait for the Dataview Index to load. The larger your vault, the longer it will take. If you see an error in the console saying "Cannot destructure currGraphs of undefined", try making this time longer. If you don\'t get that error, you can make this time shorter to make the Breadcrumbs load faster. The default is 5 seconds.'
        )
        .addText((text) =>
          text
            .setPlaceholder("Seconds")
            .setValue((plugin.settings.dvWaitTime / 1000).toString())
            .onChange(async (value) => {
              const num = Number(value);

              if (num > 0) {
                plugin.settings.dvWaitTime = num * 1000;
                await plugin.saveSettings();
              } else {
                new Notice("The interval must be a non-negative number");
              }
            })
        );
    }

    new Setting(generalDetails)
      .setName("Refresh Interval")
      .setDesc(
        "Enter an integer number of seconds to wait before Breadcrumbs auto-refreshes its data. This would update the matrix view and the trail if either are affected. (Set to 0 to disable autorefreshing)"
      )
      .addText((text) =>
        text
          .setPlaceholder("Seconds")
          .setValue(plugin.settings.refreshIntervalTime.toString())
          .onChange(async (value) => {
            clearInterval(plugin.refreshIntervalID);
            const num = Number(value);

            if (num > 0) {
              plugin.settings.refreshIntervalTime = num;
              await plugin.saveSettings();

              plugin.refreshIntervalID = window.setInterval(async () => {
                plugin.currGraphs = await plugin.initGraphs();
                if (plugin.settings.showTrail) {
                  await plugin.drawTrail();
                }
                if (plugin.getActiveMatrixView()) {
                  await plugin.getActiveMatrixView().draw();
                }
              }, num * 1000);
              plugin.registerInterval(plugin.refreshIntervalID);
            } else if (num === 0) {
              plugin.settings.refreshIntervalTime = num;
              await plugin.saveSettings();
              clearInterval(plugin.refreshIntervalID);
            } else {
              new Notice("The interval must be a non-negative number");
            }
          })
      );

    const MLViewDetails: HTMLDetailsElement = containerEl.createEl("details");
    MLViewDetails.createEl("summary", { text: "Matrix/List View" });

    new Setting(MLViewDetails)
      .setName("Show Matrix or List view by default")
      .setDesc(
        "When Obsidian first loads, which view should it show? On = Matrix, Off = List"
      )
      .addToggle((toggle) =>
        toggle.setValue(plugin.settings.defaultView).onChange(async (value) => {
          plugin.settings.defaultView = value;
          await plugin.saveSettings();
        })
      );

    // TODO I don't think this setting works anymore. I removed it's functionality when adding multiple hierarchies
    new Setting(MLViewDetails)
      .setName("Show all field names or just relation types")
      .setDesc(
        "This changes the headers in matrix/list view. You can have the headers be the list of metadata fields for each relation type (e.g. `parent, broader, upper`). Or you can have them just be the name of the relation type, i.e. 'Parent', 'Sibling', 'Child'. On = show the full list of names."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.showNameOrType)
          .onChange(async (value) => {
            plugin.settings.showNameOrType = value;
            await plugin.saveSettings();
            await plugin.getActiveMatrixView().draw();
          })
      );

    new Setting(MLViewDetails)
      .setName("Show Relationship Type")
      .setDesc(
        "Show whether a link is real or implied. A real link is one you explicitly put in a note. E.g. parent:: [[Note]]. An implied link is the reverse of a real link. For example, if A is the real parent of B, then B must be the implied child of A."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.showRelationType)
          .onChange(async (value) => {
            plugin.settings.showRelationType = value;
            await plugin.saveSettings();
            await plugin.getActiveMatrixView().draw();
          })
      );

    new Setting(MLViewDetails)
      .setName("Filter Implied Siblings")
      .setDesc(
        "Implied siblings are: 1) notes with the same parent, or 2) notes that are real siblings. This setting only applies to type 1 implied siblings. If enabled, Breadcrumbs will filter type 1 implied siblings so that they not only share the same parent, but the parent relation has the exact same type. For example, the two real relations B --parent-> A, and A --parent-> A create an implied sibling between B and C (they have the same parent, A). The two real relations B --parent-> A, and A --up-> A create an implied sibling between B and C (they also have the same parent, A). But if this setting is turned on, the second implied sibling would not show, because the parent types are differnet (parent versus up)."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.filterImpliedSiblingsOfDifferentTypes)
          .onChange(async (value) => {
            plugin.settings.filterImpliedSiblingsOfDifferentTypes = value;
            await plugin.saveSettings();
            await plugin.getActiveMatrixView().draw();
          })
      );

    new Setting(MLViewDetails)
      .setName("Open View in Right or Left side")
      .setDesc(
        "When loading the matrix view, should it open on the left or right side leaf? On = Right, Off = Left."
      )
      .addToggle((toggle) =>
        toggle.setValue(plugin.settings.rlLeaf).onChange(async (value) => {
          plugin.settings.rlLeaf = value;
          await plugin.saveSettings();
          await plugin.getActiveMatrixView()?.onClose();
          await plugin.initMatrixView(VIEW_TYPE_BREADCRUMBS_MATRIX);
        })
      );

    const trailDetails: HTMLDetailsElement = containerEl.createEl("details");
    trailDetails.createEl("summary", { text: "Trail/Grid" });

    new Setting(trailDetails)
      .setName("Show Breadcrumbs")
      .setDesc(
        "Show a trail of notes leading from your index note down to the current note you are in (if a path exists)"
      )
      .addToggle((toggle) =>
        toggle.setValue(plugin.settings.showTrail).onChange(async (value) => {
          plugin.settings.showTrail = value;
          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    new Setting(trailDetails)
      .setName("Trail or Table or Both")
      .setDesc(
        "Wether to show the regular breadcrumb trails, the table view, neither, or both. 1 = Only Trail, 2 = Only Grid, 3 = Both"
      )
      .addText((text) => {
        text
          .setValue(plugin.settings.trailOrTable.toString())
          .onChange(async (value) => {
            const num = parseInt(value);
            if ([1, 2, 3].includes(num)) {
              plugin.settings.trailOrTable = num as 1 | 2 | 3;
              await plugin.saveSettings();
              await plugin.drawTrail();
            } else {
              new Notice("The value has to be 1, 2, or 3");
            }
          });
      });

    new Setting(trailDetails)
      .setName("Grid view dots")
      .setDesc(
        "If the grid view is visible, shows dots based on the file size of each cell."
      )
      .addToggle((toggle) =>
        toggle.setValue(plugin.settings.gridDots).onChange(async (value) => {
          plugin.settings.gridDots = value;
          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    const dotsColour = trailDetails.createDiv();
    dotsColour.createEl("h4", {
      text: "Dots colour",
    });
    const dotsColourPicker = dotsColour.createEl("input", {
      type: "color",
    });

    dotsColourPicker.value = plugin.settings.dotsColour;
    dotsColourPicker.addEventListener("change", async () => {
      plugin.settings.dotsColour = dotsColourPicker.value;
      await plugin.saveSettings();
    });

    new Setting(trailDetails)
      .setName("Grid view heatmap")
      .setDesc(
        "If the grid view is visible, change the background colour of squares based on the number of children leaving that note."
      )
      .addToggle((toggle) =>
        toggle.setValue(plugin.settings.gridHeatmap).onChange(async (value) => {
          plugin.settings.gridHeatmap = value;
          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    const heatmapColour = trailDetails.createDiv();
    heatmapColour.createEl("h4", {
      text: "Heat map colour",
    });
    const heatmapColourPicker = heatmapColour.createEl("input", {
      type: "color",
    });

    heatmapColourPicker.value = plugin.settings.heatmapColour;
    heatmapColourPicker.addEventListener("change", async () => {
      plugin.settings.heatmapColour = heatmapColourPicker.value;
      await plugin.saveSettings();
    });

    new Setting(trailDetails)
      .setName("Index/Home Note(s)")
      .setDesc(
        "The note that all of your other notes lead back to. The parent of all your parent notes. Just enter the name. So if your index note is `000 Home.md`, enter `000 Home`. You can also have multiple index notes (comma-separated list). The breadcrumb trail will show the shortest path back to any one of the index notes listed. You can now leave this field empty, meaning the trail will show a path going as far up the parent-tree as possible."
      )
      .addText((text) => {
        let finalValue: string[];
        text
          .setPlaceholder("Index Note")
          .setValue([plugin.settings.indexNote].flat().join(", "))
          .onChange(async (value) => {
            finalValue = splitAndTrim(value);
          });

        text.inputEl.onblur = async () => {
          // TODO Refactor this to general purpose isInVault function

          if (finalValue[0] === "") {
            plugin.settings.indexNote = finalValue;
            await plugin.saveSettings();
          } else if (finalValue.every((index) => isInVault(this.app, index))) {
            plugin.settings.indexNote = finalValue;
            await plugin.saveSettings();
          } else {
            new Notice(`Atleast one of the notes is not in your vault`);
          }
        };
      });

    new Setting(trailDetails)
      .setName("Default: All or Shortest")
      .setDesc(
        "If multiple paths are found going up the parent tree, should all of them be shown by default, or only the shortest? On = all, off = shortest"
      )
      .addToggle((toggle) =>
        toggle.setValue(plugin.settings.showAll).onChange(async (value) => {
          plugin.settings.showAll = value;

          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    new Setting(trailDetails)
      .setName("Breadcrumb trail seperator")
      .setDesc(
        "The character to show between crumbs in the breadcrumb trail. The default is '→'"
      )
      .addText((text) =>
        text
          .setPlaceholder("→")
          .setValue(plugin.settings.trailSeperator)
          .onChange(async (value) => {
            plugin.settings.trailSeperator = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    new Setting(trailDetails)
      .setName("No path found message")
      .setDesc(
        "The text to display when no path to the index note was found, or when the current note has no parent (this happens if you haven't chosen an index note)"
      )
      .addText((text) =>
        text
          .setPlaceholder(`No path to index note was found`)
          .setValue(plugin.settings.noPathMessage)
          .onChange(async (value) => {
            plugin.settings.noPathMessage = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    new Setting(trailDetails)
      .setName("Respect Readable Line Length")
      .setDesc(
        "Should the breadcrumbs trail adjust its width to the readable line length, or use as much space as possible? On = use readable line length."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.respectReadableLineLength)
          .onChange(async (value) => {
            plugin.settings.respectReadableLineLength = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    const visModalDetails: HTMLDetailsElement = containerEl.createEl("details");
    visModalDetails.createEl("summary", { text: "Visualisation Modal" });

    new Setting(visModalDetails)
      .setName("Default Visualisation Type")
      .setDesc("Which visualisation to show by defualt")
      .addDropdown((cb: DropdownComponent) => {
        VISTYPES.forEach((option: visTypes) => {
          cb.addOption(option, option);
        });
        cb.setValue(plugin.settings.visGraph);

        cb.onChange(async (value: visTypes) => {
          plugin.settings.visGraph = value;
          await plugin.saveSettings();
        });
      });
    new Setting(visModalDetails)
      .setName("Default Relation")
      .setDesc("Which relation type to show first when opening the modal")
      .addDropdown((cb: DropdownComponent) => {
        RELATIONS.forEach((option: Relations) => {
          cb.addOption(option, option);
        });
        cb.setValue(plugin.settings.visRelation);

        cb.onChange(async (value: Relations) => {
          plugin.settings.visRelation = value;
          await plugin.saveSettings();
        });
      });
    new Setting(visModalDetails)
      .setName("Default Real/Closed")
      .setDesc("Show the real or closed graph by default")
      .addDropdown((cb: DropdownComponent) => {
        REAlCLOSED.forEach((option: string) => {
          cb.addOption(option, option);
        });
        cb.setValue(plugin.settings.visClosed);

        cb.onChange(async (value: string) => {
          plugin.settings.visClosed = value;
          await plugin.saveSettings();
        });
      });
    new Setting(visModalDetails)
      .setName("Default Unlinked")
      .setDesc("Show all nodes or only those which have links by default")
      .addDropdown((cb: DropdownComponent) => {
        ALLUNLINKED.forEach((option: string) => {
          cb.addOption(option, option);
        });
        cb.setValue(plugin.settings.visAll);

        cb.onChange(async (value: string) => {
          plugin.settings.visAll = value;
          await plugin.saveSettings();
        });
      });

    const createIndexDetails: HTMLDetailsElement =
      containerEl.createEl("details");
    createIndexDetails.createEl("summary", { text: "Create Index" });

    new Setting(createIndexDetails)
      .setName("Add wiklink brackets")
      .setDesc(
        "When creating an index, should it wrap the note name in wikilinks `[[]]` or not. On = yes, off = no."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.wikilinkIndex)
          .onChange(async (value) => {
            plugin.settings.wikilinkIndex = value;
            await plugin.saveSettings();
          })
      );

    new Setting(createIndexDetails)
      .setName("Show aliases of notes in index")
      .setDesc("Show the aliases of each note in brackets. On = yes, off = no.")
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.aliasesInIndex)
          .onChange(async (value) => {
            plugin.settings.aliasesInIndex = value;
            await plugin.saveSettings();
          })
      );

    const debugDetails: HTMLDetailsElement = containerEl.createEl("details");
    debugDetails.createEl("summary", { text: "Debugging" });

    new Setting(debugDetails)
      .setName("Debug Mode")
      .setDesc(
        "Toggling this on will enable a few console logs to appear when use the matrix/list view, or the trail."
      )
      .addToggle((toggle) =>
        toggle.setValue(plugin.settings.debugMode).onChange(async (value) => {
          plugin.settings.debugMode = value;
          await plugin.saveSettings();
        })
      );

    new Setting(debugDetails)
      .setName("Super Debug Mode")
      .setDesc("Toggling this on will enable ALOT of console logs")
      .addToggle((toggle) =>
        toggle
          .setValue(plugin.settings.superDebugMode)
          .onChange(async (value) => {
            plugin.settings.superDebugMode = value;
            await plugin.saveSettings();
          })
      );

    new KoFi({ target: this.containerEl });
  }
}
