import React from 'react';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Card from '@site/src/components/Card';
import Cards from '@site/src/components/Cards';
import type {MDXComponents} from 'mdx/types';

export default function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Make Tabs and TabItem available in MDX
    Tabs,
    TabItem,
    // Make Card and Cards available in MDX (for both current and versioned docs)
    Card,
    Cards,
    // Spread other components
    ...components,
  };
}
