package com.devmind.springbackend.repository;

import com.devmind.springbackend.model.SourceFile;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SourceFileRepository extends Neo4jRepository<SourceFile, String> {
}
