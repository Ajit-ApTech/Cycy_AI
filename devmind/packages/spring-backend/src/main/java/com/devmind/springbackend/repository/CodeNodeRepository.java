package com.devmind.springbackend.repository;

import com.devmind.springbackend.model.CodeNode;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CodeNodeRepository extends Neo4jRepository<CodeNode, Long> {
}
