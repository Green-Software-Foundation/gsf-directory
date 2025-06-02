import { defineCollection, z } from "astro:content";
import { Client } from "@notionhq/client";
import fs from "fs/promises";
import path from "path";

console.log("NOTION_TOKEN", import.meta.env.NOTION_TOKEN);
console.log("NOTION_TOKEN", process.env.NOTION_TOKEN);
// Define the schema for your Notion data
const projectsSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  workingGroup: z.object({
    name: z.string().optional(),
  }),
  icon: z.string().optional(),
  website: z.string().url().nullish(),
  repo: z.string().url().nullish(),
  googleGroup: z.string().email().nullish(),
  pageContent: z.string().optional(),
  lifecycleStage: z.string().optional(),
  launchDate: z.string().optional(),
  leads: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().nullish(),
        role: z.string().nullish(),
        city: z.string().nullish(),
        title: z.string().nullish(),
        company: z.string().nullish(),
        linkedin: z.string().url().nullish(),
      })
      .nullish()
  ),
});

const membersSchema = z.object({
  id: z.string(),
  logo: z.string().nullish(),
  name: z.string(),
  description: z.string().nullish(),
  level: z.string(),
  website: z.string().nullish(),
  membershipSince: z.string().nullish(),
  leads: z
    .array(
      z
        .object({
          id: z.string(),
          name: z.string().nullish(),
          role: z.string().nullish(),
          city: z.string().nullish(),
          title: z.string().nullish(),
          company: z.string().nullish(),
          linkedin: z.string().url().nullish(),
        })
        .nullish()
    )
    .optional(),
});

// Define schema for working groups
const workingGroupsSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  website: z.string().url().nullish(),
  repo: z.string().url().nullish(),
  googleGroup: z.string().email().nullish(),
  pageContent: z.string().optional(),
  leads: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().nullish(),
        role: z.string().nullish(),
        city: z.string().nullish(),
        title: z.string().nullish(),
        company: z.string().nullish(),
        linkedin: z.string().url().nullish(),
      })
      .nullish()
  ),
  projects: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        type: z.string(),
        icon: z.string().optional(),
        workingGroup: z
          .object({
            name: z.string().optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

// Define schema for committees (same as working groups schema)
const committeesSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  website: z.string().url().nullish(),
  repo: z.string().url().nullish(),
  googleGroup: z.string().email().nullish(),
  pageContent: z.string().optional(),
  leads: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().nullish(),
        role: z.string().nullish(),
        city: z.string().nullish(),
        title: z.string().nullish(),
        company: z.string().nullish(),
        linkedin: z.string().url().nullish(),
      })
      .nullish()
  ),
  members: z
    .array(
      z
        .object({
          id: z.string(),
          name: z.string().nullish(),
          role: z.string().nullish(),
          city: z.string().nullish(),
          title: z.string().nullish(),
          company: z.string().nullish(),
          linkedin: z.string().url().nullish(),
        })
        .nullish()
    )
    .optional(),
  projects: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        type: z.string(),
        icon: z.string().optional(),
        workingGroup: z
          .object({
            name: z.string().optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

// Initialize Notion client
const notion = new Client({
  auth: import.meta.env.NOTION_TOKEN,
});

const projectsResponse = await notion.databases.query({
  database_id: import.meta.env.NOTION_PROJECTS_DATABASE_ID,
  filter: {
    and: [
      {
        property: "Internal Status",
        select: {
          equals: "Active",
        },
      },
      {
        property: "Type",
        or: [
          {
            property: "Type",
            select: {
              equals: "Committee Project",
            },
          },
          {
            property: "Type",
            select: {
              equals: "WG Project",
            },
          },
        ],
      },
      {
        property: "Offer Subscription",
        select: {
          equals: "Yes",
        },
      },
    ],
  },
});

const subscriptionResponse = await notion.databases.query({
  database_id: import.meta.env.NOTION_SUBSCRIPTIONS_DATABASE_ID,
  filter: {
    and: [
      {
        property: "Subscription Status",
        select: {
          equals: "Active",
        },
      },
      {
        property: "Role for Subscription",
        or: [
          {
            property: "Role for Subscription",
            select: {
              equals: "Organization Lead",
            },
          },
          {
            property: "Role for Subscription",
            select: {
              equals: "Working Group Chair",
            },
          },
          {
            property: "Role for Subscription",
            select: {
              equals: "Project Lead",
            },
          },
          {
            property: "Role for Subscription",
            select: {
              equals: "Project Co-Lead",
            },
          },
          {
            property: "Role for Subscription",
            select: {
              equals: "Committee Chair",
            },
          },
          {
            property: "Role for Subscription",
            select: {
              equals: "Committee Vice-Chair",
            },
          },
          {
            property: "Role for Subscription",
            select: {
              equals: "Committee Member",
            },
          },
        ],
      },
    ],
  },
});

// Create dictionary of organization leads grouped by company
const orgLeadsDict = subscriptionResponse.results.reduce(
  (acc: { [key: string]: any[] }, subscription: any) => {
    const company = subscription.properties["API-MN"]?.formula?.string;
    const role = subscription.properties["Role for Subscription"]?.select?.name;
    if (
      company &&
      (role === "Organization Lead" ||
        role === "Project Lead" ||
        role === "Committee Chair" ||
        role === "Committee Member")
    ) {
      if (!acc[company]) {
        acc[company] = [];
      }
      acc[company].push({
        id: subscription.properties.Volunteers?.relation?.[0]?.id,
        name:
          subscription.properties["First Name"]?.rollup?.array?.[0]
            ?.rich_text?.[0]?.plain_text +
          " " +
          subscription.properties.Surname?.rollup?.array?.[0]?.rich_text?.[0]
            ?.plain_text,
        city: subscription.properties.City?.rollup?.array?.[0]?.rich_text?.[0]
          ?.plain_text,
        title:
          subscription.properties.Title?.rollup?.array?.[0]?.rich_text?.[0]
            ?.plain_text,
        linkedin:
          subscription.properties["Volunteer LinkedIn"]?.rollup?.array?.[0]
            ?.url,
        role,
      });
    }
    return acc;
  },
  {}
);

const membersResponse = await notion.databases.query({
  database_id: import.meta.env.NOTION_MEMBERS_DATABASE_ID,
  filter: {
    and: [
      {
        property: "Status",
        select: {
          equals: "Active",
        },
      },
    ],
  },
});

const projects = defineCollection({
  loader: async () => {
    try {
      // Save project icons to static folder
      projectsResponse.results.forEach(async (page: any) => {
        if (page.icon?.[page.icon?.type]?.url) {
          const iconUrl = page.icon?.[page.icon?.type]?.url;
          try {
            const response = await fetch(iconUrl);
            const extension = iconUrl
              .split("?")[0]
              .split(".")
              .pop()
              ?.toLowerCase();

            // Handle different file types appropriately
            let iconData;
            if (extension === "svg") {
              iconData = await response.text();
            } else {
              const buffer = await response.arrayBuffer();
              iconData = Buffer.from(buffer);
            }

            // Ensure static/icons directory exists
            const iconDir = path.join(
              process.cwd(),
              "public",
              "assets",
              "projects"
            );
            await fs.mkdir(iconDir, { recursive: true });

            // Save icon with project ID as filename
            const iconPath = path.join(iconDir, `${page.id}.${extension}`);
            await fs.writeFile(iconPath, iconData);
          } catch (error) {
            console.error(`Error saving icon for project ${page.id}:`, error);
          }
        }
      });
      // Transform Notion response to match our schema
      const projects = projectsResponse.results.map(async (page: any) => {
        const title = page.properties.Name?.title?.[0]?.plain_text || "";
        const iconUrl = page.icon?.[page.icon?.type]?.url;
        const iconExtension = iconUrl?.split("?")[0].split(".").pop();
        const icon = iconUrl
          ? `/assets/projects/${page.id}.${iconExtension}`
          : undefined;
        const leads = subscriptionResponse?.results?.filter(
          (subscription: any) => {
            return subscription.properties.PWCIs?.relation?.some(
              (relation: any) => relation.id == page.id
            );
          }
        );

        // Fetch page content
        let pageContent = "";
        try {
          const pageBlocks = await notion.blocks.children.list({
            block_id: page.id,
          });
          pageContent = await renderNotionBlocks(pageBlocks.results);
        } catch (error) {
          console.error(`Error fetching page content for ${page.id}:`, error);
        }
        return {
          id: page.id,
          title,
          type: page.properties.Type?.select?.name || "",
          description:
            page.properties.Description?.rich_text?.[0]?.plain_text || "",
          workingGroup: {
            name: page.properties["Parent"]?.select?.name || "",
          },
          icon,
          website: page.properties["Website URL"]?.url,
          repo: page.properties["Repo URL"]?.url,
          googleGroup: page.properties["Google Group"]?.email?.trim(),
          pageContent,
          lifecycleStage: page.properties["Lifecycle Stage"]?.select?.name,
          launchDate: page.properties["Launch date"]?.date?.start
            ? new Date(page.properties["Launch date"].date.start)
                .toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
                .replace(",", "")
            : undefined,
          leads: leads.map((subscription: any) => ({
            id: subscription.properties.Volunteers?.relation?.[0]?.id,
            name:
              (subscription.properties["First Name"]?.rollup?.array?.[0]
                ?.rich_text?.[0]?.plain_text || "") +
              " " +
              (subscription.properties.Surname?.rollup?.array?.[0]
                ?.rich_text?.[0]?.plain_text || ""),
            role: subscription.properties["Role for Subscription"]?.select
              ?.name,
            city: subscription.properties.City?.rollup?.array?.[0]
              ?.rich_text?.[0]?.plain_text,
            title:
              subscription.properties.Title?.rollup?.array?.[0]?.rich_text?.[0]
                ?.plain_text,
            company: subscription.properties["API-MN"]?.formula?.string,
            linkedin:
              subscription.properties["Volunteer LinkedIn"]?.rollup?.array?.[0]
                ?.url,
          })),
        };
      });

      return await Promise.all(projects);
    } catch (error) {
      console.error("Error fetching Notion data:", error);
      return [];
    }
  },
  schema: projectsSchema,
});

const members = defineCollection({
  loader: async () => {
    try {
      // Save member logos to static folder
      membersResponse.results.forEach(async (page: any) => {
        if (page.properties.Logo?.files?.[0]?.file?.url) {
          const logoUrl = page.properties.Logo?.files?.[0]?.file?.url;
          try {
            const response = await fetch(logoUrl);
            const extension = logoUrl
              .split("?")[0]
              .split(".")
              .pop()
              ?.toLowerCase();

            // Handle different file types appropriately
            let logoData;
            if (extension === "svg") {
              logoData = await response.text();
            } else {
              const buffer = await response.arrayBuffer();
              logoData = Buffer.from(buffer);
            }

            // Ensure static/icons directory exists
            const logoDir = path.join(
              process.cwd(),
              "public",
              "assets",
              "members"
            );
            await fs.mkdir(logoDir, { recursive: true });

            // Save logo with member ID as filename
            const logoPath = path.join(logoDir, `${page.id}.${extension}`);
            await fs.writeFile(logoPath, logoData);
          } catch (error) {
            console.error(`Error saving logo for member ${page.id}:`, error);
          }
        }
      });
      const members = membersResponse.results.map((page: any) => {
        const name =
          page.properties["Member Name "]?.title?.[0]?.plain_text || "";
        const description =
          page.properties.Description?.rich_text?.[0]?.plain_text;
        const logoUrl = page.properties.Logo?.files?.[0]?.file?.url;
        const logoExtension = logoUrl?.split("?")[0].split(".").pop();
        const logo = logoUrl
          ? `/assets/members/${page.id}.${logoExtension}`
          : undefined;
        const level = page.properties["Membership Level "]?.select?.name;
        const website = page.properties["Website"]?.url;
        const membershipSince = page.properties["Membership Start Date"]?.date
          ?.start
          ? new Date(page.properties["Membership Start Date"].date.start)
              .toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
              .replace(",", "")
          : undefined;
        return {
          id: page.id,
          logo,
          name,
          description,
          level,
          website,
          membershipSince,
          leads: orgLeadsDict[name],
        };
      });
      return members;
    } catch (error) {
      console.error("Error fetching Notion data for:", error);
      return [];
    }
  },
  schema: membersSchema,
});

const workingGroups = defineCollection({
  loader: async () => {
    try {
      // Query for working groups from the projects database
      // We're assuming working groups are in the same database as projects
      // but with a different type
      const workingGroupsResponse = await notion.databases.query({
        database_id: import.meta.env.NOTION_PROJECTS_DATABASE_ID,
        filter: {
          and: [
            {
              property: "Internal Status",
              select: {
                equals: "Active",
              },
            },
            {
              property: "Type",
              select: {
                equals: "Working Group",
              },
            },
          ],
        },
      });

      // Save working group icons to static folder
      workingGroupsResponse.results.forEach(async (page: any) => {
        if (page.icon?.[page.icon?.type]?.url) {
          const iconUrl = page.icon?.[page.icon?.type]?.url;
          try {
            const response = await fetch(iconUrl);
            const extension = iconUrl
              .split("?")[0]
              .split(".")
              .pop()
              ?.toLowerCase();

            // Handle different file types appropriately
            let iconData;
            if (extension === "svg") {
              iconData = await response.text();
            } else {
              const buffer = await response.arrayBuffer();
              iconData = Buffer.from(buffer);
            }

            // Ensure static/icons directory exists
            const iconDir = path.join(
              process.cwd(),
              "public",
              "assets",
              "working-groups"
            );
            await fs.mkdir(iconDir, { recursive: true });

            // Save icon with working group ID as filename
            const iconPath = path.join(iconDir, `${page.id}.${extension}`);
            await fs.writeFile(iconPath, iconData);
          } catch (error) {
            console.error(
              `Error saving icon for working group ${page.id}:`,
              error
            );
          }
        }
      });

      // Transform Notion response to match our schema
      const workingGroups = workingGroupsResponse.results.map(
        async (page: any) => {
          const title = page.properties.Name?.title?.[0]?.plain_text || "";
          const iconUrl = page.icon?.[page.icon?.type]?.url;
          const iconExtension = iconUrl?.split("?")[0].split(".").pop();
          const icon = iconUrl
            ? `/assets/working-groups/${page.id}.${iconExtension}`
            : undefined;

          // Find leads for this working group
          const leads = subscriptionResponse.results.filter(
            (subscription: any) => {
              return subscription.properties.PWCIs?.relation?.some(
                (relation: any) => relation.id == page.id
              );
            }
          );

          // Fetch page content
          let pageContent = "";
          try {
            const pageBlocks = await notion.blocks.children.list({
              block_id: page.id,
            });
            pageContent = await renderNotionBlocks(pageBlocks.results);
          } catch (error) {
            console.error(`Error fetching page content for ${page.id}:`, error);
          }

          // Find projects that belong to this working group
          const relatedProjects = projectsResponse.results
            .filter((project: any) => {
              return project.properties["Parent"]?.select?.name === title;
            })
            .map((project: any) => {
              const projectTitle =
                project.properties.Name?.title?.[0]?.plain_text || "";
              const projectIconUrl = project.icon?.[project.icon?.type]?.url;
              const projectIconExtension = projectIconUrl
                ?.split("?")[0]
                .split(".")
                .pop();
              const projectIcon = projectIconUrl
                ? `/assets/projects/${project.id}.${projectIconExtension}`
                : undefined;

              return {
                id: project.id,
                title: projectTitle,
                description:
                  project.properties.Description?.rich_text?.[0]?.plain_text ||
                  "",
                type: project.properties.Type?.select?.name || "",
                icon: projectIcon,
                workingGroup: {
                  name: title,
                },
              };
            });

          return {
            id: page.id,
            title,
            type: page.properties.Type?.select?.name || "Working Group",
            description:
              page.properties.Description?.rich_text?.[0]?.plain_text || "",
            icon,
            website: page.properties["Website URL"]?.url,
            repo: page.properties["Repo URL"]?.url,
            googleGroup: page.properties["Google Group"]?.email?.trim(),
            pageContent,
            leads: leads.map((subscription: any) => ({
              id: subscription.properties.Volunteers?.relation?.[0]?.id,
              name:
                (subscription.properties["First Name"]?.rollup?.array?.[0]
                  ?.rich_text?.[0]?.plain_text || "") +
                " " +
                (subscription.properties.Surname?.rollup?.array?.[0]
                  ?.rich_text?.[0]?.plain_text || ""),
              role: subscription.properties["Role for Subscription"]?.select
                ?.name,
              city: subscription.properties.City?.rollup?.array?.[0]
                ?.rich_text?.[0]?.plain_text,
              title:
                subscription.properties.Title?.rollup?.array?.[0]
                  ?.rich_text?.[0]?.plain_text,
              company: subscription.properties["API-MN"]?.formula?.string,
              linkedin:
                subscription.properties["Volunteer LinkedIn"]?.rollup
                  ?.array?.[0]?.url,
            })),
            projects: relatedProjects,
          };
        }
      );

      return await Promise.all(workingGroups);
    } catch (error) {
      console.error("Error fetching working groups data:", error);
      return [];
    }
  },
  schema: workingGroupsSchema,
});

// Query for committees from the projects database
const committeesResponse = await notion.databases.query({
  database_id: import.meta.env.NOTION_PROJECTS_DATABASE_ID,
  filter: {
    and: [
      {
        property: "Internal Status",
        select: {
          equals: "Active",
        },
      },
      {
        property: "Type",
        select: {
          equals: "Committee",
        },
      },
    ],
  },
});

// Save committee icons to static folder
committeesResponse.results.forEach(async (page: any) => {
  if (page.icon?.[page.icon?.type]?.url) {
    const iconUrl = page.icon?.[page.icon?.type]?.url;
    try {
      const response = await fetch(iconUrl);
      const extension = iconUrl.split("?")[0].split(".").pop()?.toLowerCase();

      // Handle different file types appropriately
      let iconData;
      if (extension === "svg") {
        iconData = await response.text();
      } else {
        const buffer = await response.arrayBuffer();
        iconData = Buffer.from(buffer);
      }

      // Ensure static/icons directory exists
      const iconDir = path.join(
        process.cwd(),
        "public",
        "assets",
        "committees"
      );
      await fs.mkdir(iconDir, { recursive: true });

      // Save icon with committee ID as filename
      const iconPath = path.join(iconDir, `${page.id}.${extension}`);
      await fs.writeFile(iconPath, iconData);
    } catch (error) {
      console.error(`Error saving icon for committee ${page.id}:`, error);
    }
  }
});

const committees = defineCollection({
  loader: async () => {
    try {
      // Transform Notion response to match our schema
      const committees = committeesResponse.results.map(async (page: any) => {
        const title = page.properties.Name?.title?.[0]?.plain_text || "";
        const iconUrl = page.icon?.[page.icon?.type]?.url;
        const iconExtension = iconUrl?.split("?")[0].split(".").pop();
        const icon = iconUrl
          ? `/assets/committees/${page.id}.${iconExtension}`
          : undefined;

        // Find leads for this committee
        const committeePeople = subscriptionResponse.results.filter(
          (subscription: any) => {
            return subscription.properties.PWCIs?.relation?.some(
              (relation: any) => relation.id == page.id
            );
          }
        );
        const leads = committeePeople.filter((subscription: any) => {
          return (
            subscription.properties["Role for Subscription"]?.select?.name ===
              "Committee Chair" ||
            subscription.properties["Role for Subscription"]?.select?.name ===
              "Committee Vice-Chair"
          );
        });
        const members = committeePeople.filter((subscription: any) => {
          return (
            subscription.properties["Role for Subscription"]?.select?.name ===
            "Committee Member"
          );
        });

        // Fetch page content
        let pageContent = "";
        try {
          const pageBlocks = await notion.blocks.children.list({
            block_id: page.id,
          });
          pageContent = await renderNotionBlocks(pageBlocks.results);
        } catch (error) {
          console.error(`Error fetching page content for ${page.id}:`, error);
        }

        // Find projects that belong to this committee
        const relatedProjects = projectsResponse.results
          .filter((project: any) => {
            return project.properties["Parent"]?.select?.name === title;
          })
          .map((project: any) => {
            const projectTitle =
              project.properties.Name?.title?.[0]?.plain_text || "";
            const projectIconUrl = project.icon?.[project.icon?.type]?.url;
            const projectIconExtension = projectIconUrl
              ?.split("?")[0]
              .split(".")
              .pop();
            const projectIcon = projectIconUrl
              ? `/assets/projects/${project.id}.${projectIconExtension}`
              : undefined;

            return {
              id: project.id,
              title: projectTitle,
              description:
                project.properties.Description?.rich_text?.[0]?.plain_text ||
                "",
              type: project.properties.Type?.select?.name || "",
              icon: projectIcon,
              workingGroup: {
                name: title,
              },
            };
          });

        return {
          id: page.id,
          title,
          type: page.properties.Type?.select?.name || "Committee",
          description:
            page.properties.Description?.rich_text?.[0]?.plain_text || "",
          icon,
          website: page.properties["Website URL"]?.url,
          repo: page.properties["Repo URL"]?.url,
          googleGroup: page.properties["Google Group"]?.email?.trim(),
          pageContent,
          leads: leads.map((subscription: any) => ({
            id: subscription.properties.Volunteers?.relation?.[0]?.id,
            name:
              (subscription.properties["First Name"]?.rollup?.array?.[0]
                ?.rich_text?.[0]?.plain_text || "") +
              " " +
              (subscription.properties.Surname?.rollup?.array?.[0]
                ?.rich_text?.[0]?.plain_text || ""),
            role: subscription.properties["Role for Subscription"]?.select
              ?.name,
            city: subscription.properties.City?.rollup?.array?.[0]
              ?.rich_text?.[0]?.plain_text,
            title:
              subscription.properties.Title?.rollup?.array?.[0]?.rich_text?.[0]
                ?.plain_text,
            company: subscription.properties["API-MN"]?.formula?.string,
            linkedin:
              subscription.properties["Volunteer LinkedIn"]?.rollup?.array?.[0]
                ?.url,
          })),
          members: members.map((subscription: any) => ({
            id: subscription.properties.Volunteers?.relation?.[0]?.id,
            name:
              (subscription.properties["First Name"]?.rollup?.array?.[0]
                ?.rich_text?.[0]?.plain_text || "") +
              " " +
              (subscription.properties.Surname?.rollup?.array?.[0]
                ?.rich_text?.[0]?.plain_text || ""),
            role: subscription.properties["Role for Subscription"]?.select
              ?.name,
            city: subscription.properties.City?.rollup?.array?.[0]
              ?.rich_text?.[0]?.plain_text,
            title:
              subscription.properties.Title?.rollup?.array?.[0]?.rich_text?.[0]
                ?.plain_text,
            company: subscription.properties["API-MN"]?.formula?.string,
            linkedin:
              subscription.properties["Volunteer LinkedIn"]?.rollup?.array?.[0]
                ?.url,
          })),
          projects: relatedProjects,
        };
      });

      return await Promise.all(committees);
    } catch (error) {
      console.error("Error fetching committees data:", error);
      return [];
    }
  },
  schema: committeesSchema,
});

export const collections = {
  projects,
  members,
  workingGroups,
  committees,
};

async function renderNotionBlocks(blocks) {
  let html = "";

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        html += `<p>${await renderRichText(block.paragraph.rich_text)}</p>`;
        break;
      case "heading_1":
        html += `<h1>${await renderRichText(block.heading_1.rich_text)}</h1>`;
        break;
      case "heading_2":
        html += `<h2>${await renderRichText(block.heading_2.rich_text)}</h2>`;
        break;
      case "heading_3":
        html += `<h3>${await renderRichText(block.heading_3.rich_text)}</h3>`;
        break;
      case "bulleted_list_item":
        html += `<li>${await renderRichText(
          block.bulleted_list_item.rich_text
        )}</li>`;
        break;
      case "numbered_list_item":
        html += `<li>${await renderRichText(
          block.numbered_list_item.rich_text
        )}</li>`;
        break;
      case "code":
        html += `<pre><code class="language-${block.code.language}">${block.code.rich_text[0].plain_text}</code></pre>`;
        break;
      case "image":
        const imageUrl =
          block.image.type === "external"
            ? block.image.external.url
            : block.image.file.url;
        html += `<img src="${imageUrl}" alt="${
          block.image.caption?.[0]?.plain_text || ""
        }" />`;
        break;
    }
  }

  return html;
}

async function renderRichText(richText) {
  let text = "";

  for (const textBlock of richText) {
    let content = textBlock.plain_text;

    if (textBlock.annotations.bold) {
      content = `<strong>${content}</strong>`;
    }
    if (textBlock.annotations.italic) {
      content = `<em>${content}</em>`;
    }
    if (textBlock.annotations.strikethrough) {
      content = `<del>${content}</del>`;
    }
    if (textBlock.annotations.underline) {
      content = `<u>${content}</u>`;
    }
    if (textBlock.annotations.code) {
      content = `<code>${content}</code>`;
    }
    if (textBlock.href) {
      content = `<a href="${textBlock.href}" target="_blank" rel="noopener noreferrer">${content}</a>`;
    }

    text += content;
  }

  return text;
}
