import React from "react";
import { RHFArrayIdField } from "./RHFArrayIdField";
import type { formOptions, IdLabel } from "@/types/formData.type";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
interface Props {
  skillsOptions: IdLabel[];
}
function MultipleCheckboxes({ skillsOptions }: Props) {
  return (
    <div>
      <RHFArrayIdField
        name="skills"
        render={(selectedSkills, setSkills, error) => (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {skillsOptions.map((skill) => {
                const isSelected = selectedSkills.some(
                  (s) => s.id === skill.id,
                );

                return (
                  <Label
                    key={skill.id}
                    className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-white/10"
                  >
                    <Checkbox
                      id="toggle-2"
                      checked={isSelected}
                      onCheckedChange={(e) => {
                        console.log({ e });
                        if (e) {
                          setSkills([...selectedSkills, skill]);
                        } else {
                          setSkills(
                            selectedSkills.filter((s) => s.id !== skill.id),
                          );
                        }
                      }}
                      className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-white/10 data-[state=checked]:text-white"
                    />
                    <div className="grid gap-1.5 font-normal">
                      <p className="text-sm leading-none font-medium">
                        {skill.label}
                      </p>
                    </div>
                  </Label>
                );
              })}
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>
        )}
      />
    </div>
  );
}

export default MultipleCheckboxes;
