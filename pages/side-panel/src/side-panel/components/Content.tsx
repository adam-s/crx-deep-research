import React from 'react';
import { makeStyles } from '@fluentui/react-components';
import { useAlgoliaSearch } from '../hooks/useAlgoliaSearch';
import { Stories } from './hacker-news/Stories';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    padding: '10px',
    boxSizing: 'border-box',
    flex: '1 0 auto',
    position: 'relative',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
});

export const Content: React.FC = () => {
  const styles = useStyles();
  const { latestResults } = useAlgoliaSearch();

  return (
    <div className={styles.root}>
      {latestResults && Array.isArray(latestResults.hits) ? (
        <Stories stories={latestResults.hits} />
      ) : (
        <pre style={{ width: '100%', height: '100%', margin: 0, overflow: 'auto' }}>No results</pre>
      )}
    </div>
  );
};
