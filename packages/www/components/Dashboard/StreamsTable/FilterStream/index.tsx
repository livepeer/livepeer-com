import { Box, Button, Flex, Text } from "@livepeer.com/design-system";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useCallback, useState } from "react";
import {
  CheckIcon,
  FilterIcon,
  SelectIcon,
  StyledAccordion,
  StyledHeader,
  StyledButton,
  StyledItem,
  StyledPanel,
  NextIcon,
  CalendarIcon,
} from "./Helpers";

const filters = [
  {
    name: "Stream name",
    options: ["contains", "is equal to"],
    field: "text",
  },
  {
    name: "Created date",
    options: ["contains", "is equal to"],
    field: "date",
  },
  {
    name: "Last active",
  },
  {
    name: "Lifetime duration",
  },
];

const StreamFilter = () => {
  const [selectedFilter, setSelectedFilter] = useState("");

  const handleClear = useCallback(() => {
    setSelectedFilter("");
  }, []);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger as="div">
        <Button
          css={{ display: "flex", ai: "center", marginRight: "6px" }}
          size="2"
          variant="gray">
          <Flex css={{ marginRight: "5px" }}>
            <FilterIcon />
          </Flex>
          Filter
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" sideOffset={5}>
        <Box
          css={{
            backgroundColor: "$loContrast",
            width: "241px",
            maxWidth: "241px",
            display: "flex",
            flexDirection: "column",
            marginRight: "6px",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow:
              "0px 5px 14px rgba(0, 0, 0, 0.22), 0px 0px 2px rgba(0, 0, 0, 0.2)",
          }}>
          <Flex
            css={{
              width: "100%",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 7px",
              background: "$panel",
            }}>
            <Button onClick={handleClear} size="1" variant="gray">
              Clear
            </Button>
            <Text size="2" css={{ margin: "0px" }}>
              Filters
            </Text>
            <Button size="1" variant="violet">
              Done
            </Button>
          </Flex>
          <StyledAccordion type="single">
            {filters.map((each, idx) => (
              <StyledItem value={each.name} key={idx}>
                <StyledHeader>
                  <StyledButton
                    onClick={() =>
                      setSelectedFilter(
                        each.name === selectedFilter ? "" : each.name
                      )
                    }>
                    <Box
                      css={{
                        minWidth: "13px",
                        minHeight: "13px",
                        borderRadius: "4px",
                        boxShadow: "0px 0px 2px $colors$slate",
                        margin: "0px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor:
                          each.name === selectedFilter
                            ? "darkgray"
                            : "transparent",
                      }}>
                      {each.name === selectedFilter && <CheckIcon />}
                    </Box>
                    <Text
                      size="2"
                      // @ts-ignore
                      css={{ marginLeft: "9px", fontWeight: "500" }}>
                      {each.name}
                    </Text>
                  </StyledButton>
                </StyledHeader>
                {each.options && (
                  <StyledPanel>
                    <Box
                      css={{
                        width: "100%",
                        height: "26px",
                        padding: "0px 11px",
                        borderRadius: "4px",
                        boxShadow: "0px 0px 2px #000000",
                        margin: "0px",
                        display: "flex",
                        justifyContent: "center",
                        flexDirection: "column",
                        background: "$loContrast",
                      }}>
                      <Flex
                        css={{
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}>
                        <Text
                          size="2"
                          // @ts-ignore
                          css={{ fontWeight: "500" }}>
                          {each.options[0]}
                        </Text>
                        <Flex>
                          <SelectIcon />
                        </Flex>
                      </Flex>
                    </Box>
                    <Flex
                      css={{
                        alignItems: "center",
                        marginTop: "10px",
                      }}>
                      <Flex>
                        <NextIcon />
                      </Flex>
                      <Box
                        css={{
                          width: "100%",
                          maxWidth: each.field === "date" ? "85px" : "100%",
                          height: "26px",
                          padding: "0px 11px",
                          borderRadius: "4px",
                          boxShadow: "0px 0px 2px #000000",
                          margin: "0px 0px 0px 11px",
                          display: "flex",
                          alignItems: "center",
                          background: "$loContrast",
                        }}>
                        {each.field === "date" && (
                          <Flex>
                            <CalendarIcon />
                          </Flex>
                        )}
                      </Box>
                    </Flex>
                  </StyledPanel>
                )}
              </StyledItem>
            ))}
          </StyledAccordion>
        </Box>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

export default StreamFilter;