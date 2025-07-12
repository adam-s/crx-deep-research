import { useState, useEffect } from 'react';
import { autorun } from 'vs/base/common/observable';
import { useService } from './useService';
import { IAlgoliaSearchResponse } from '@shared/services/algolia-search.service';
import { ISubmissionDetectionService } from '@src/services/submission-detection.service';

interface UseAlgoliaSearchReturn {
  latestResults: IAlgoliaSearchResponse | undefined;
  submissionDetectionService: ISubmissionDetectionService | undefined;
}

export const useAlgoliaSearch = (): UseAlgoliaSearchReturn => {
  const submissionDetectionService = useService(ISubmissionDetectionService);
  const [latestResults, setLatestResults] = useState<IAlgoliaSearchResponse | undefined>(undefined);

  useEffect(() => {
    if (!submissionDetectionService) return;
    const disposer = autorun(reader => {
      const results = submissionDetectionService.searchResults$.read(reader);
      setLatestResults(results);
    });
    return () => {
      disposer.dispose();
    };
  }, [submissionDetectionService]);

  return { latestResults, submissionDetectionService };
};
